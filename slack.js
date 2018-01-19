const Slack = require('slack-node');

const slack = new Slack();

const env = process.env.NODE_ENV;
const domain = env === 'production' ? 'https://weco.io' : 'http://webapp-dev.eu9ntpt33z.eu-west-1.elasticbeanstalk.com';
const iconWeco = 'https://s3-us-west-2.amazonaws.com/slack-files2/avatars/2017-02-02/136111767555_a0c541b8e8fdec77e42b_132.jpg';
const webhooks = {
  activityTracker: 'https://hooks.slack.com/services/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',
  general: 'https://hooks.slack.com/services/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',
  lmenus: 'https://hooks.slack.com/services/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',
};

slack.setWebhook(env === 'production' ? webhooks.activityTracker : webhooks.lmenus);

const webhook = data => {
  slack.webhook(data, err => {
    if (err) {
      console.error(err);
    }
  });
};

const newAccount = (name, email, username) => {
  const username_namespace = `u/${username}`;
  const url = `${domain}/${username_namespace}`;
  const text = `${name} just registered on Weco! 🎉`;

  webhook({
    attachments: [{
      fallback: `${text} ${url}`,
      color: '#3c8Ce7',
      pretext: text,
      author_name: username_namespace,
      author_link: url,
      title: name,
      title_link: url,
      footer: 'Weco',
      footer_icon: iconWeco,
      ts: Math.floor(Date.now() / 1000),
    }],
  });
};

const newPost = (username, postid, title, type, tags) => {
  const post_namespace = `p/${postid}`;
  const url = `${domain}/b/root/${post_namespace}`;
  const text = `${username} posted a new ${type}. 🚀`;

  webhook({
    attachments: [{
      fallback: `${text} ${title} ${url}`,
      color: '#9de599',
      pretext: text,
      author_name: post_namespace,
      author_link: url,
      title,
      title_link: url,
      fields: [{
        title: 'Tags',
        value: tags.join(', '),
        short: false,
      }],
      footer: 'Weco',
      footer_icon: iconWeco,
      ts: Math.floor(Date.now() / 1000),
    }],
  });
};

module.exports = {
  newAccount,
  newPost,
};
