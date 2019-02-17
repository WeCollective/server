const sendgrid = require('@sendgrid/mail')
const sendgridLegacy = require('sendgrid')(process.env.SENDGRID_MAIL_API_KEY)
// const ContactImporter = require('@sendgrid/contact-importer')

sendgrid.setApiKey(process.env.SENDGRID_MAIL_API_KEY)

// const contactImporter = new ContactImporter(sendgrid)
const padDigit = num => num < 10 ? `0${num}` : num

const mmddyyyy = date => {
  const mm = (date.getMonth() + 1).toString()
  const dd = date.getDate().toString()
  const yyyy = date.getFullYear()
  return `${padDigit(mm)}/${padDigit(dd)}/${yyyy}`
}

const send = async (message, user) => {
  try {
    if (!message.from) {
      message.from = {
        email: process.env.WECO_EMAIL,
        name: 'James from WECO',
      }
    }

    if (!message.to) {
      message.to = user.email
    }

    await sendgrid.send(message)
  }
  catch (e) {
    throw e
  }
}

module.exports.addContact = (user, update = false) => new Promise((resolve, reject) => {
  const req = sendgridLegacy.emptyRequest();
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

  sendgridLegacy.API(req, (err, res) => {
    console.log(res.body)

    if (err || (res && res.body && res.body.error_count > 0)) {
      return reject();
    }

    return resolve();
  });
})

module.exports.sendResetPasswordLink = (user, token) => send({
  subject: 'WE Collective | Reset password',
  substitutions: {
    name: user.name,
    reset_url: `${process.env.WEBAPP_URL}reset-password/${user.username}/${token}`,
    username: user.username,
  },
  template_id: 'a9c63f7e-a7f6-4d16-b788-2241c2fd1d0a',
}, user)

module.exports.sendVerification = (user, token) => send({
  subject: 'WE Collective | Verify your account',
  substitutions: {
    name: user.name,
    username: user.username,
    verify_url: `${process.env.WEBAPP_URL + user.username}/verify/${token}`,
  },
  template_id: '76ae83b3-3bac-4f9b-afe6-08b220916a32',
}, user)

module.exports.sendWelcome = user => send({
  subject: 'Welcome to the WE Collective!',
  substitutions: {
    name: user.name,
    username: user.username,
  },
  template_id: '1b91558d-aa4d-4722-adb2-a264ba754706',
}, user)
