const sendgrid = require('@sendgrid/mail')

sendgrid.setApiKey(process.env.SENDGRID_MAIL_API_KEY)

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
