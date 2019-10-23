# Use cases:
To create a locked guarantee send the gaurantee amount + 10 000 bytes with 'create = true', 'account_name = <unique account name>' and 'owner = <address of the owner for who you should lock a guarantee for>'. 
  
Once locked, it will require consensus between the 2 parties on how to distribute it to unlock it. Both parties should use 'account_name = <unique account name>' and'proposition = <part of the guarantee you are agree to release for the other party>''.
  
When the sum of the 2 propositions is equal to the guarantee amount, the guarantee is unlock and distribute accordingly to  the 2 parties.
