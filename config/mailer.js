var sendgrid = require('sendgrid')(process.env.SENDGRID_MAIL_API_KEY);
var mailHelper = require('sendgrid').mail;

function mmddyyyy(date) {
  var mm = (date.getMonth() + 1).toString();
  var dd = (date.getDate()).toString();
  return [mm.length == 1 ? '0' + mm : mm, '/', dd.length == 1 ? '0' + dd : dd, '/', date.getFullYear()].join('');
}

module.exports = {
  sendVerification: function(user, token) {
    return new Promise(function(resolve, reject) {
      var mail = new mailHelper.Mail();
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL, 'James from WECO'));
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
  },
  sendWelcome: function(user) {
    return new Promise(function(resolve, reject) {
      var mail = new mailHelper.Mail();
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL, 'James from WECO'));
      mail.setSubject('Welcome to the WE Collective!');
      var personalization = new mailHelper.Personalization();
      personalization.addTo(new mailHelper.Email(user.email));
      personalization.addSubstitution(new mailHelper.Substitution('%firstname%', user.firstname));
      personalization.addSubstitution(new mailHelper.Substitution('%username%', user.username));
      mail.addPersonalization(personalization);
      mail.setTemplateId("1b91558d-aa4d-4722-adb2-a264ba754706");

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
  },
  addContact: function(user, update) {
    return new Promise(function(resolve, reject) {
      var request = sendgrid.emptyRequest();
      request.body = [
        {
          "email": user.email,
          "first_name": user.firstname,
          "last_name": user.lastname,
          "username": user.username,
          "datejoined": mmddyyyy(new Date(user.datejoined)),
          "num_branches": user.num_branches,
          "num_comments": user.num_comments,
          "num_posts": user.num_posts,
          "num_mod_positions": user.num_mod_positions
        }
      ];
      if(user.dob) request.body[0]["dob"] = mmddyyyy(new Date(user.dob));
      
      request.method = update ? 'PATCH' : 'POST';
      request.path = '/v3/contactdb/recipients';

      sendgrid.API(request, function (error, response) {
        if(error) reject();
        if(JSON.parse(response.body).error_count > 0) reject();
        resolve();
      });
    });
  },
  sendResetPasswordLink: function(user, token) {
    return new Promise(function(resolve, reject) {
      var mail = new mailHelper.Mail();
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL, 'James from WECO'));
      mail.setSubject('WE Collective | Reset password');
      var personalization = new mailHelper.Personalization();
      personalization.addTo(new mailHelper.Email(user.email));
      personalization.addSubstitution(new mailHelper.Substitution('%firstname%', user.firstname));
      personalization.addSubstitution(new mailHelper.Substitution('%username%', user.username));
      personalization.addSubstitution(new mailHelper.Substitution('%reset_url%', process.env.WEBAPP_URL + 'reset-password/' + user.username + '/' + token));
      mail.addPersonalization(personalization);
      mail.setTemplateId("a9c63f7e-a7f6-4d16-b788-2241c2fd1d0a");

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
