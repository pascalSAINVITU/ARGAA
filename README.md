# ARGAA
## A Renting Guarantee Autonomous Agent
Two parties agree on the amount of a renting guarantee, the renter send the amount as well as the address of the other party to the AA, If later both agree on how to spread the guarantee, it is paid to both parties.

#Use cases:
* Create an named guarantee by sending its amount and the address of the other party:
   * 'create' = <amount of guarantee>
   * 'other_party' = <address>
* Each party can propose the part of the guarantee amount to release to the other_party:
   * 'amount' = <amount for the other party>
* The owner of the AA can withdraw the dust.
