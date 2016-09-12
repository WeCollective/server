var sendgrid = require('sendgrid')(process.env.SENDGRID_MAIL_API_KEY);
var mailHelper = require('sendgrid').mail;

module.exports = {
  sendVerification: function(user, token) {
    return new Promise(function(resolve, reject) {
      var mail = new mailHelper.Mail();
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL));
      mail.setSubject('WE Collective | Verify your account');
      var personalization = new mailHelper.Personalization();
      personalization.addTo(new mailHelper.Email(user.email));
      personalization.addSubstitution(new mailHelper.Substitution('%firstname%', user.firstname));
      personalization.addSubstitution(new mailHelper.Substitution('%username%', user.username));
      personalization.addSubstitution(new mailHelper.Substitution('%verify_url%', process.env.WEBAPP_URL + user.username + '/verify/' + token));
      mail.addPersonalization(personalization);
      mail.setTemplateId("76ae83b3-3bac-4f9b-afe6-08b220916a32");

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
