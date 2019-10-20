/*jslint node: true */
'use strict';
const constants = require('ocore/constants.js');
const conf = require('ocore/conf');
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');
const validationUtils = require('ocore/validation_utils');
const headlessWallet = require('headless-obyte');


var aa_address = 'JO7J7IB2DPLBLLDSYX26Z34DL7YV5NPR';
var step = "";


	let assocDeviceWithTypeOfUser = {};
	let assocDeviceWithUserAddress = {};
	let assocDeviceWithOwner = {};
	let assocDeviceWithAccountName = {};
	let assocDeviceAddressToPeerAddress = {};
	let assocPeerAddressToDeviceAddress = {};
	

/**
 * headless wallet is ready
 */
eventBus.once('headless_wallet_ready', () => {
	headlessWallet.setupChatEventHandlers();
	const walletGeneral = require('ocore/wallet_general.js');
	const eventBus = require('ocore/event_bus.js');
	walletGeneral.addWatchedAddress(aa_address, () => {
		eventBus.on('aa_response_from_aa-' + aa_address, (objAAResponse) => {
			// handle event
			var msg = "received response from " + aa_address + " :  " + JSON.stringify( objAAResponse )
			console.log( msg )
			// device.sendMessageToDevice( registered , 'text' , msg ) 
			
			console.log("****************************************aa_response_from_aa"+objAAResponse);
			try{
				var trigger_address = objAAResponse.trigger_address
				//if( trigger_address == obot_address ) return // prevent responding to itself

				var responseVars = objAAResponse.response.responseVars 
				var job = responseVars.job

				if( responseVars.args == false ) var result = "missing input array"
				else {

					var arr = JSON.parse( responseVars.args )

					console.log( "job " + job + " args " + JSON.stringify( arr ) )

					var result = arr.sort() // the actual processing
				}

			}catch( e ){
				var result = e.toString()
			}

			var json_data = { job: job , result: JSON.stringify( result ) }
			var opts = {
				//paying_addresses: [ obot_address ],
				//change_address: obot_address ,
				messages: [
					{ app: 'data',
						payload_location: 'inline' ,
						payload_hash: json_data,
						payload: json_data
					}
				],
				to_address: aa_address ,
				amount: 10000
			}
			headlessWallet.sendMultiPayment( opts , ( err , unit ) => {
				if( err ) return console.log( err )

				//successful
				console.log( "sent back result " + JSON.stringify( result ) ) 
			})
			
		});
	});
	/**
	 * user pairs his device with the bot
	 */
	eventBus.on('paired', (from_address, pairing_secret) => {
		// send a geeting message
		const device = require('ocore/device.js');
		device.sendMessageToDevice(from_address, 'text', "Welcome to S(HA)afe bot!");
	});

	function getAAState(aa_address)
	{
		const network = require('ocore/Network.js');
		network.light/get_aa_state_vars
	}
	
	
	function identifying(from_address, text) {
		
		const device = require('ocore/device.js');
		var answer = "";
		switch(step) {
			case "IDENTIFY1": // find out if we speak to renter or owner
				answer = "Are you the [owner](command:OWNER) or the [renter](command:RENTER) of the thing?";
				device.sendMessageToDevice(from_address, 'text', answer);
				step = "IDENTIFY2";
				break;
			case "IDENTIFY2":
				if (text.toUpperCase() === "OWNER" || text.toUpperCase() === "RENTER" )
				{
					assocDeviceWithTypeOfUser[from_address] = text.toUpperCase() ;
					answer = "Please insert your address with (...)";
					device.sendMessageToDevice(from_address, 'text', answer);
					step = "IDENTIFY3";
				}
				else
				{
					//replay 1
					step = "IDENTIFY1";
					creating(from_address,'');
				}
				break;
			case "IDENTIFY3":
				if (validationUtils.isValidAddress(text.trim()))
				{
					assocDeviceAddressToPeerAddress[from_address] = text;
					assocPeerAddressToDeviceAddress[text] = from_address;
					answer = "Address saved";
					device.sendMessageToDevice(from_address, 'text', answer);
					step = "";
					help(from_address);
				}
				else
				{
					// replay 2
					step = "IDENTIFY2";
					creating(from_address,assocDeviceWithTypeOfUser[from_address]);
				}
				break;
			default:
		}
	}
	
	function creating(from_address, text) {
		
		const device = require('ocore/device.js');
		var answer = "";
		switch(step) {
			case "CREATE1": // find out if we speak to renter or owner
				answer = "What is the address (from a single address wallet) of the owner?";
				device.sendMessageToDevice(from_address, 'text', answer);
				step = "CREATE2";
				break;
			case "CREATE2":
				if (validationUtils.isValidAddress(text))
				{
					assocDeviceWithOwner[from_address] = text.toUpperCase() ;
					answer = "How do you want to name the guarantee account?";
					device.sendMessageToDevice(from_address, 'text', answer);
					step = "CREATE3";
				}
				else
				{
					step = "CREATE1";
					creating(from_address,'');
				}
				break;
			case "CREATE3":
				assocDeviceWithAccountName[from_address] = text.toUpperCase();
				answer = "How big is the requested guarantee amount in bytes? (i.e. 10 000 000)";
				device.sendMessageToDevice(from_address, 'text', answer);
				step = "CREATE4";
				break;
			case "CREATE4":
				let trimmedText = text.replace(" ","");
				let parsedValue = parseInt(trimmedText);
				if (!isNaN(parsedValue))
				{
					const device = require('ocore/device.js');
					const base64url = require('base64url');
					let data = {
						create: 1,
						account_name: assocDeviceWithAccountName[from_address],
						owner: assocDeviceWithOwner[from_address]
					};
					let json_string = JSON.stringify(data);
					let base64data = base64url(json_string);
					console.log("*************************"+ base64data);
						
					var total_amount = parseInt(text.replace(' ','')) + 10000;
					device.sendMessageToDevice(from_address, 'text',
						 "[balance](byteball:" + aa_address + "?amount=" + total_amount + "&base64data=" + base64data + ")");
					step = ""; 
				}
				else
				{
					// replay 3
					step = "CREATE3";
					creating(from_address,'');
				}
				break;
			default:
		}
	}
	
	function withdrawing(from_address, text) {
		
		const device = require('ocore/device.js');
		var answer = "";
		switch(step) {
			case "withdraw1":
				answer = "What is the hash of the storage that you want to withdraw?";
				step = "withdraw2";
				device.sendMessageToDevice(from_address, 'text', answer);
				break;
			case "withdraw2":
				step = "proove1";
				device.sendMessageToDevice( from_address , 'text' ,request_withdraw(from_address, text) );
				break;
			default:
		}
	}
	
	function learn(from_address, text) {
		const device = require('ocore/device.js');
		var answer = "SHAAFE is an AA create by Obie 'sharjar' is allows to store safely some assets into an AA. When storing, you provide a hash of a secret phrase. A hash is easy to compute, but from a hash it is impossible to compute back the secret phrase. Later when you want to withdraw, you have to provide the secret phrase, the AA will then hash it if is correspond to the stored hash, it will proove that you are the owner. The problem is that the DAG is slow, confirmation will require several minutes, so an hacker can see your secret phrase and create a competing transaction on another branch of the DAG. To avoid this, you first announce to the AA that you will soon provide the secret for a given hash, so the AA will only accept secret phrase coming from you during an hour and nobody can compete you any more";
		device.sendMessageToDevice(from_address, 'text', answer);
	}
	
	function help(from_address){
		const device = require('ocore/device.js');
		if (assocDeviceWithTypeOfUser[from_address])
		{
			console.log ("*************************************"+assocDeviceWithTypeOfUser[from_address]);
			if (assocDeviceWithTypeOfUser[from_address] === "OWNER")
				device.sendMessageToDevice(from_address, 'text', "I know you as an owner ([change](command:IDENTIFY)), you can do a [proposition](command:PROPOSITION) representing the amount of bytes you are agree to release to the renter.");
			else if (assocDeviceWithTypeOfUser[from_address] === "RENTER")
				device.sendMessageToDevice(from_address, 'text', "I know you as an renter ([change](command:IDENTIFY)), you can [create](command:CREATE) a new renting guarantee or do a [proposition](command:PROPOSITION) representing the amount of bytes from an existing guarantee you are agree to release to the owner.");
			
		}
		else
			device.sendMessageToDevice(from_address, 'text', "Options are: [Identify](command:IDENTIFY) yourself as a renter of owner, if you are renter you can [create](command:CREATE) a new renting guarantee");
	};
	
	/**
	 * user sends message to the bot
	 */
	eventBus.on('text', (from_address, text) => {
		console.log("****************************************");
		const device = require('ocore/device.js');
		// analyze the text and respond
		text = text.trim();
		
		var command = text.toUpperCase();
		debug_address = from_address;
		
		if (command == "IDENTIFY") step = "IDENTIFY1";
		if (command == "CREATE") step = "CREATE1";
		if (command == "HASH") step = "hash1"
		if (command == "LEARN") step = "learn"
		if (command == "WITHDRAW") step = "withdraw1"
		if (command == "PROOVE") step = "proove1"
		if (command == "HELP") step = "help"
		
		
		if (/^CREATE/.test(step))
			creating(from_address,text.trim());
		else if (/^IDENTIFY/.test(step))
			identifying(from_address,text.trim());
		else if (step === "") help(from_address);
	});

});
var debug_address;

/**
 * user pays to the bot
 */
eventBus.on('new_my_transactions', (arrUnits) => {
	// handle new unconfirmed payments
	// and notify user
	
	console.log("****************************************new_my_transactions"+arrUnits);

	console.log("****************************************my_transactions_became_stable"+arrUnits);
	paymentWithUserInTheOutput(arrUnits, false);
	paymentReceivedByAA(arrUnits, false);
	
	
});

function paymentWithUserInTheOutput(arrUnits, stable)
{
	const device = require('ocore/device.js');
	db.query("SELECT address, amount, asset FROM outputs WHERE unit IN (?)", [arrUnits], rows => {
		rows.forEach(row => {
			let deviceAddress = assocPeerAddressToDeviceAddress[row.address];
			if (row.asset === null && deviceAddress) {
			   device.sendMessageToDevice(deviceAddress, 'text', 'You were part of the=' + stable + ' output: ' + row.amount + ' bytes');
			   return true;
			}
		})
	});
}

function paymentReceivedByAA(arrUnits, stable)
{
	const device = require('ocore/device.js');
	
	db.query("SELECT address FROM unit_authors WHERE unit IN (?) ", [arrUnits], rows => {
		rows.forEach(row => {
			console.log("**************************************** unit_authors "+row.address);
	
			let deviceAddress = assocPeerAddressToDeviceAddress[row.address];
			if (deviceAddress) { // user is the author
				console.log("**************************************** deviceAddress "+deviceAddress);
				db.query("SELECT address, amount, asset FROM outputs WHERE unit IN (?)", [row], rows => {
					rows.forEach(row2 => {
						
						console.log("**************************************** outputs "+row2);
						if (row2.asset === null && aa_address) {
						   device.sendMessageToDevice(deviceAddress, 'text', 'AA received your stable=' + stable + ' payment from you: ' + row2.amount + ' bytes');
						   return true;
						}
					})
				});
			}
		})
	});
}
/**
 * payment is confirmed
 */
eventBus.on('my_transactions_became_stable', (arrUnits) => {
	// handle payments becoming confirmed
	// and notify user
	console.log("****************************************my_transactions_became_stable"+arrUnits);
	paymentWithUserInTheOutput(arrUnits, true);
	paymentReceivedByAA(arrUnits, true);
});



process.on('unhandledRejection', up => { throw up; });
