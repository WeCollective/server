const mailHelper = require('sendgrid').mail;
const sendgrid   = require('sendgrid')(process.env.SENDGRID_MAIL_API_KEY);

function mmddyyyy(date) {
  const mm = (date.getMonth() + 1).toString();
  const dd = date.getDate().toString();
  return [mm < 10 ? ('0' + mm) : mm, '/', dd < 10 ? ('0' + dd) : dd, '/', date.getFullYear()].join('');
}

module.exports = {
  addContact: (user, update) => {
    return new Promise( (resolve, reject) => {
      let req = sendgrid.emptyRequest();
      req.body = [{
        datejoined: mmddyyyy(new Date(user.datejoined)),
        email: user.email,
        name: user.name,
        num_branches: user.num_branches,
        num_comments: user.num_comments,
        num_mod_positions: user.num_mod_positions,
        num_posts: user.num_posts,
        username: user.username
      }];

      if (user.dob) {
        req.body[0]['dob'] = mmddyyyy(new Date(user.dob));
      }

      req.method = update ? 'PATCH' : 'POST';
      req.path = '/v3/contactdb/recipients';

      sendgrid.API(req, (err, res) => {
        console.log(res.body)

        if (err || res.body.error_count > 0) {
          return reject();
        }

        return resolve();
      });
    });
  },

  sendResetPasswordLink: (user, token) => {
    return new Promise( (resolve, reject) => {
      const mail = new mailHelper.Mail();
      const personalization = new mailHelper.Personalization();

      personalization.addTo(new mailHelper.Email(user.email));
      personalization.addSubstitution(new mailHelper.Substitution('%name%', user.name));
      personalization.addSubstitution(new mailHelper.Substitution('%username%', user.username));
      personalization.addSubstitution(new mailHelper.Substitution('%reset_url%', `${process.env.WEBAPP_URL}reset-password/${user.username}/${token}`));

      mail.addPersonalization(personalization);
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL, 'James from WECO'));
      mail.setSubject('WE Collective | Reset password');
      mail.setTemplateId('a9c63f7e-a7f6-4d16-b788-2241c2fd1d0a');

      const req = sendgrid.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON()
      });

      sendgrid.API(req, (err, res) => {
        if (err) {
          return reject();
        }
        
        return resolve();
      });
    });
  },

  sendVerification: (user, token) => {
    return new Promise( (resolve, reject) => {
      const mail = new mailHelper.Mail();
      const personalization = new mailHelper.Personalization();

      personalization.addTo(new mailHelper.Email(user.email));
      personalization.addSubstitution(new mailHelper.Substitution('%name%', user.name));
      personalization.addSubstitution(new mailHelper.Substitution('%username%', user.username));
      personalization.addSubstitution(new mailHelper.Substitution('%verify_url%', `${process.env.WEBAPP_URL + user.username}/verify/${token}`));

      mail.addPersonalization(personalization);
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL, 'James from WECO'));
      mail.setSubject('WE Collective | Verify your account');
      mail.setTemplateId('76ae83b3-3bac-4f9b-afe6-08b220916a32');

      const req = sendgrid.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON()
      });

      sendgrid.API(req, (err, res) => {
        if (err) {
          return reject();
        }
        
        return resolve();
      });
    });
  },

  sendWelcome: user => {
    return new Promise( (resolve, reject) => {
      const mail = new mailHelper.Mail();
      const personalization = new mailHelper.Personalization();

      personalization.addTo(new mailHelper.Email(user.email));
      personalization.addSubstitution(new mailHelper.Substitution('%name%', user.name));
      personalization.addSubstitution(new mailHelper.Substitution('%username%', user.username));

      mail.addPersonalization(personalization);
      mail.setFrom(new mailHelper.Email(process.env.WECO_EMAIL, 'James from WECO'));
      mail.setSubject('Welcome to the WE Collective!');
      mail.setTemplateId('1b91558d-aa4d-4722-adb2-a264ba754706');

      const req = sendgrid.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON()
      });

      sendgrid.API(req, (err, res) => {
        if (err) {
          return reject();
        }
        
        return resolve();
      });
    });
  }
};
