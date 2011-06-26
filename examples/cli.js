/**
 * Cloudcontrol API Commandline Interface
 */
var cc = require('../lib/cloudcontrol').createClient({
  user: 'YOUR_CLOUDCONTROL_EMAIL',
  pass: 'YOUR_CLOUDCONTROL_PASSWORD'
})
cc.app('YOUR_CLOUDCONTROL_APP').deployment('YOUR_CLOUDCONTROL_DEPLOYMENT').addon.get(function(err, obj) {
  console.log(obj)
})

