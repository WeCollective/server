var sendgrid = require('sendgrid')(process.env.SENDGRID_MAIL_API_KEY);
var mailHelper = require('sendgrid').mail;

module.exports = {
  sendVerification: function(user, token) {
    return new Promise(function(resolve, reject) {
      var from_email = new mailHelper.Email(process.env.WECO_EMAIL);
      var to_email = new mailHelper.Email(user.email);
      var content = new mailHelper.Content("text/plain", "Token: " + token + "\nUser: " + JSON.stringify(user));
      var mail = new mailHelper.Mail(from_email, "WE Collective | Verify your email", to_email, content);

      var request = sendgrid.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON()
      });

      sendgrid.API(request, function(error, response) {
        if(error) reject();
        resolve();
      });
    });
  }
};
