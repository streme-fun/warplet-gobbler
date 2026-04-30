Here are some launch variables we need to finalize. Some of these I think we have decided on, others not so much. Note that Buy and Sell settings can be changed post-launch, while token config cannot.

Note the values below are either 1) one we've agreed to, OR 2) values I am proposing. All are open to discussion, ofc.

Token
==============
Symbol: `WARPGOBB`
Name: `Warplet Gobbler`
LP type: `Uni v4`
Fee: `10%`
Staking Supply: `10B`
Staking rewards duration: `365 days`
Staking lock period: `30 days`
Vault allocations: `None` (if anyone has a case for team/airdrop/rewards/other allocations, now is the time to present it!)
Reward split: `50/50` (note: the streme default is 40/60, with 40% going to 'deployer' and 60 to streme team. for gobbler, deployer is the amount that will get streamed to DutchAuction, and thus affect how quickly the balance rises towards the warplet floor. the remainder is what is avaiulable for 'profit'. Unlike the above vars, this one CAN BE CHANGED post launch) 

BUY
==============
(no settable vars)

Fee Handler
==============
Target Stream Duration: `7 days`

AuctionSell (these can be changed later)
==============
auction duration: `24 hours`
minimum bid: `6,900,000 WARPGOBB` (perhaps we try to tweak this to 50% of floor price, or some other target)
min increment: `10%` (notes: if we decided to lowball the min bid, then we can increase the increment. depends on whether we issue XP for bids)
time buffer 🍿: `5 minutes` (note: popcorn bidding, if big received with less than the buffer left until the end of the auction, then the auction gets extended by this amount of time. prevents last-second sniping)