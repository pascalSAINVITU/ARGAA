/*jslint node: true */
'use strict';
const constants = require('ocore/constants.js');
const conf = require('ocore/conf');
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');
const validationUtils = require('ocore/validation_utils');
const headlessWallet = require('headless-obyte');
const network = require('ocore/network.js');

var aa_address = 'FISR6BC5HFEJ433MMGSSCW4NXUCOFXLA';
var step = "";

let assocDeviceWithTypeOfUser = {};
let assocDeviceWithUserAddress = {};
let assocDeviceWithOwner = {};
let assocDeviceWithAccountName = {};
let assocDeviceWithGuaranteeAmount = {};
let assocDeviceAddressToPeerAddress = {};
let assocPeerAddressToDeviceAddress = {};

function get64basedData (data){
	const base64url = require('base64url');
					
	let json_string = JSON.stringify(data);
	let encodedString = base64url(json_string);
	
	// depending on the size of the input data, the encoded string ends with one
	// or two equal signs '=' that need to be removed
	while ( encodedString.substring(encodedString.length - 1) === "=") {
		encodedString = encodedString.substring(0, encodedString.length - 1);;
	}
	
	log("encodedstring:"+encodedString);
	
	return encodedString;
}

function reply(from_address, text){
	const device = require('ocore/device.js');
	log("replies: "+text);
	device.sendMessageToDevice(from_address, 'text', text);
}

function log(text){
	console.log("ARGAA: "+text);
}

function identifying(from_address, text) {
	const device = require('ocore/device.js');
	try{
		reply(from_address, "");
		switch(step) {
			case "IDENTIFY1": // find out if we speak to renter or owner
				reply(from_address, "Are you the [owner](command:OWNER) or the [renter](command:RENTER) of the thing?");
				step = "IDENTIFY2";
				break;
			case "IDENTIFY2":
				if (text.toUpperCase() === "OWNER" || text.toUpperCase() === "RENTER" )
				{
					assocDeviceWithTypeOfUser[from_address] = text.toUpperCase();
					reply(from_address, "Please insert your address with (...)");
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
					reply(from_address, "Address saved");
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
	catch( e ){
		reply('text', "Identification failed: "+ e.toString());
		step ="";
		help(from_address);
	}
}

function creating(from_address, text) {
	
	try{
		switch(step) {
			case "CREATE1": // find out if we speak to renter or owner
				reply(from_address, "What is the address (from a single address wallet) of the owner?");
				step = "CREATE2";
				break;
			case "CREATE2":
				if (validationUtils.isValidAddress(text))
				{
					assocDeviceWithOwner[from_address] = text.toUpperCase() ;
					reply(from_address, "How do you want to name the guarantee account?");
					step = "CREATE3";
				}
				else
				{
					step = "CREATE1";
					creating(from_address,'');
				}
				break;
			case "CREATE3":
				let name = text;
				getFromAAIfKeyExist(from_address, name+"_guarantee", (state_value) => {
					var guarantee_amount = state_value;
					log("guarantee_amount: "+guarantee_amount);
					if (guarantee_amount === "undefined" )
					{	
						assocDeviceWithAccountName[from_address] = name;
						reply(from_address, "How big is the requested guarantee amount in bytes? (i.e. 10 000 000)");
						step = "CREATE4";
					}
					else
					{
						reply(from_address, "This name already exist!");
						step = "CREATE2"; // replay 2
						creating(from_address, assocDeviceWithOwner[from_address]);
					}
				});
				break;
			case "CREATE4":
				let trimmedText = text.replace(" ","");
				let parsedValue = parseInt(trimmedText);
				if (!isNaN(parsedValue))
				{
					let data = {
						create: 1,
						account_name: assocDeviceWithAccountName[from_address],
						owner: assocDeviceWithOwner[from_address]
					};
					let base64data = get64basedData(data);
						
					var total_amount = parseInt(text.replace(' ','')) + 10000;
					let URI = "byteball:" + aa_address + "?amount=" + total_amount + "&base64data=" + base64data;
					let command = "[balance]("+URI+")";
					log("URI: "+URI);
					reply(from_address, "Please click on the following link to send the funds and data to ARGAA. "+
					"10,000 byte has been added as bounce fee, most of it will be send back to you.");
					reply(from_address,  command);
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
	catch( e ){
		reply(from_address, "Guarantee creation failed: "+ e.toString());
		step ="";
		help(from_address);
	}
}

function getFromAAIfKeyExist(from_address, key, func){
	log("looking for: "+key);
	var network = require('ocore/network.js');
	network.requestFromLightVendor(
		'light/get_aa_state_vars', 
		{address: aa_address}, 
		function(ws, request, response){
			if (response.error)
			{
				reply(from_address, "Error: "+ response.error);
				return;
			}
			for (var i in response)
			{
				if (i===key)
				{
					log("found in state var: "+response[i]);
					func (response[i]);
					return;
				}
			}
			func("undefined");
		}
	);
}

function proposing(from_address, text) {
	try {
		switch(step) {
			case "PROPOSITION1": // name?
				reply(from_address, "What is the name of the guarantee?");
				step = "PROPOSITION2";
				break;
			case "PROPOSITION2": // proposition?
				let guarantee_name = text;
				assocDeviceWithAccountName[from_address] = guarantee_name;
				getFromAAIfKeyExist(from_address, guarantee_name+"_guarantee", (amount) => {
					if (amount ==="undefined")
					{
						reply(from_address, "This name does not exist!");
						step = "PROPOSITION1";
						proposing(from_address,"");
					}
					else
					{
						assocDeviceWithGuaranteeAmount[from_address] = amount;
						reply(from_address, "The guarantee total amount is " + amount + " bytes");
						getFromAAIfKeyExist(from_address, guarantee_name+"_owner", (owner) => {
							getFromAAIfKeyExist(from_address, guarantee_name+"_renter", (renter) => {
								
								getFromAAIfKeyExist(from_address, guarantee_name+"_renter_proposition", (renter_proposition) => {
									getFromAAIfKeyExist(from_address, guarantee_name+"_owner_proposition", (owner_proposition) => {
										reply(from_address, "The owner and renter addresses are : "+owner+", "+renter+", "+
										"you must use one of these addresses to be able to do a proposition. "+
										"For now, the renter proposal is "+renter_proposition +". The one from the owner is "+owner_proposition+". "+
										"As reminder, the sum of both proposals must equals to the total amount in order to unlocked funds from the AA. ");
										reply(from_address, "What part from the "+ amount +" bytes do you want to release for the other party? Enter the amount in bytes or choose one of those percentage."+
										"[20%](command:"+ Math.round(amount * 0.2)+ "), " +
										"[50%](command:"+ Math.round(amount * 0.5)+ "), " +
										"[80%](command:"+ Math.round(amount * 0.8)+ "), [full](command:"+amount+").");
										step = "PROPOSITION3";
									});
								});	
							});
						});
					}
				});
				break;
			case "PROPOSITION3": // send proposition 
				let proposition = text.replace(" ","");
				let parsedValue = parseInt(proposition);
				if (!isNaN(parsedValue))
				{
					if (parsedValue <= assocDeviceWithGuaranteeAmount[from_address])
					{
						let data = {
							proposition: parsedValue,
							account_name: assocDeviceWithAccountName[from_address],
						};
						let base64data = get64basedData(data);
							
						var total_amount = parseInt(text.replace(' ','')) + 10000;
						let URI = "byteball:" + aa_address + "?amount=" + total_amount + "&base64data=" + base64data;
						let command = "[balance]("+URI+")";
						log("URI: "+URI);
						reply(from_address, "Please click on the following link to send the data to ARGAA. "+
						"10,000 byte has been added as bounce fee, most of it will be send back to you.");
						reply(from_address,  command);
						//step = "";  
					}
					else
					{
						reply (from_address, "Must be smaller then "+ assocDeviceWithGuaranteeAmount[from_address] + " bytes !");
						step = "PROPOSITION2";  // replay 2
						creating(from_address, assocDeviceWithAccountName[from_address]);
					}
				}
				else
				{
					reply (from_address, "Must be an integer !");
					step = "PROPOSITION2";  // replay 2
					creating(from_address, assocDeviceWithAccountName[from_address]);
				}
				break;
			default:
		}
	}
	catch( e ){
		reply(from_address,  "Proposition failed: "+ e.toString());
		step ="";
		help(from_address);
	}
}

function learn(from_address) {
	reply(from_address, "ARGAA, help you to lock a guarantee that can be unlock only, if both parties find an agreement on how to spread it. "+
	"ARGAA address is "+aa_address);
}

function help(from_address){
	if (assocDeviceWithTypeOfUser[from_address])
	{
		log("recognized as: "+assocDeviceWithTypeOfUser[from_address]);
		if (assocDeviceWithTypeOfUser[from_address] === "OWNER")
		{
			reply(from_address, "I know you as an owner ([change](command:IDENTIFY)), "+
			"you can do a [proposition](command:PROPOSITION) representing the amount of bytes you are agree to release to the renter.");
		}
		else if (assocDeviceWithTypeOfUser[from_address] === "RENTER")
		{
			reply(from_address, "I know you as an renter ([change](command:IDENTIFY)), "+
			"you can [create](command:CREATE) a new renting guarantee or do a [proposition](command:PROPOSITION) "+
			"representing the amount of bytes from an existing guarantee you are agree to release to the owner.");
		}
	}
	else
	{
		reply(from_address, "Options are: [Identify](command:IDENTIFY) yourself as a renter of owner, so that I can monitor your interaction with the AA. "+
		"If you are renter you can [create](command:CREATE) a new renting guarantee. "+
		"Owner or renter you can make a [proposition](command:PROPOSITION) to unlock an existing guarantee where you are one of the parties. "+
		"[Learn](command:LEARN) more about ARGAA. ");
	}
}

eventBus.once('headless_wallet_ready', () => {
	
	headlessWallet.setupChatEventHandlers();
	const walletGeneral = require('ocore/wallet_general.js');
	const eventBus = require('ocore/event_bus.js');
		
	walletGeneral.addWatchedAddress(aa_address, () => {
		eventBus.on('aa_response_from_aa-' + aa_address, (objAAResponse) => {
			// handle event
			var msg = "received response from " + aa_address + " :  " + JSON.stringify( objAAResponse )
			
			var address = assocPeerAddressToDeviceAddress[objAAResponse.trigger_address];
			
			if (address)
			{
				reply(address, objAAResponse.response.responseVars.message);
			}
			// console.log( msg )
			// // device.sendMessageToDevice( registered , 'text' , msg ) 
			
			// log("aa_response_from_aa: "+objAAResponse);
			// try{
				// var trigger_address = objAAResponse.trigger_address

				// var responseVars = objAAResponse.response.responseVars 
				// var job = responseVars.job

				// if( responseVars.args == false ) var result = "missing input array"
				// else {

					// var arr = JSON.parse( responseVars.args )

				// }

			// }catch( e ){
				// var result = e.toString()
			// }

			// var json_data = { job: job , result: JSON.stringify( result ) }
			// var opts = {
				// //paying_addresses: [ obot_address ],
				// //change_address: obot_address ,
				// messages: [
					// { app: 'data',
						// payload_location: 'inline' ,
						// payload_hash: json_data,
						// payload: json_data
					// }
				// ],
				// to_address: aa_address ,
				// amount: 10000
			// }
			// headlessWallet.sendMultiPayment( opts , ( err , unit ) => {
				// if( err ) return console.log( err )

				// //successful
				// console.log( "sent back result " + JSON.stringify( result ) ) 
			// })
			
		});
	});
	
	eventBus.on('paired', (from_address, pairing_secret) => {
		// send a geeting message
		const device = require('ocore/device.js');
		device.sendMessageToDevice(from_address, 'text', "Welcome to ARGAA bot!");
		help(from_address);
	});

	eventBus.on('text', (from_address, text) => {
		
		// analyze the text and respond
		text = text.trim();
		
		var command = text.toUpperCase();
		
		if (command == "IDENTIFY") step = command+"1";
		if (command == "CREATE") step = command+"1";
		if (command == "PROPOSITION") step = command+"1";
		if (command == "HELP") step = command;
		if (command == "STOP") step = command;
		if (command == "LEARN") step = command;
		
		if (/^CREATE/.test(step)) creating(from_address,text.trim());
		else if (/^IDENTIFY/.test(step)) identifying(from_address,text.trim());
		else if (/^PROPOSITION/.test(step)) proposing(from_address,text.trim());
		else if (/^STOP/.test(step)) help(from_address);
		else if (/^HELP/.test(step)) help(from_address);
		else if (/^LEARN/.test(step)) learn(from_address);
		else if (step === "") help(from_address);
	});
});

eventBus.on('new_my_transactions', (arrUnits) => {
	//paymentWithUserInTheOutput(arrUnits, false);
	paymentReceivedByAA(arrUnits, false);
	
	
});

function paymentWithUserInTheOutput(arrUnits, stable){
	db.query("SELECT address, amount, asset FROM outputs WHERE unit IN (?)", [arrUnits], rows => {
		rows.forEach(row => {
			let deviceAddress = assocPeerAddressToDeviceAddress[row.address];
			if (row.asset === null && deviceAddress) {
			   reply(deviceAddress, 'You were part of the stable=' + stable + ' output: ' + row.amount + ' bytes');
			   return true;
			}
		})
	});
}

function paymentReceivedByAA(arrUnits, stable){
	db.query("SELECT unit_authors.address, outputs.amount FROM outputs JOIN unit_authors USING(unit) WHERE outputs.unit IN(?) AND outputs.address = ? AND outputs.asset IS NULL;", 
	[arrUnits, aa_address], function(rows) {
		rows.forEach(row => {
			let deviceAddress = assocPeerAddressToDeviceAddress[row.address];
			if (deviceAddress) {
			   reply(deviceAddress, 'ARGAA received your payment of ' + row.amount + ' bytes ('+ (stable? "stable": "unstable"));
			   return true;
			}
		});
	});
}

eventBus.on('my_transactions_became_stable', (arrUnits) => {
	// handle payments becoming confirmed
	// and notify user
	console.log("****************************************my_transactions_became_stable"+arrUnits);
	//paymentWithUserInTheOutput(arrUnits, true);
	paymentReceivedByAA(arrUnits, true);
});

process.on('unhandledRejection', up => { throw up; });