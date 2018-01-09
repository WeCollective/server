module.exports = () => ({
  allowedHeaders: [
    'Accept',
    'Authorization',
    'Content-Type',
    'Origin',
    'X-Requested-With',
  ],
  credentials: true,
  methods: [
    'DELETE',
    'GET',
    'POST',
    'PUT',
  ],
  optionsSuccessStatus: 200,
  origin(origin, callback) {
    const whitelist = [
      'http://localhost:8081',
      'https://localhost:8081',

      'http://webapp-dev.eu9ntpt33z.eu-west-1.elasticbeanstalk.com',
      'https://webapp-dev.eu9ntpt33z.eu-west-1.elasticbeanstalk.com',

      'http://webapp-prod.eu-west-1.elasticbeanstalk.com',
      'https://webapp-prod.eu-west-1.elasticbeanstalk.com',

      'http://www.weco.io',
      'https://www.weco.io',
      'http://weco.io',
      'https://weco.io',
    ];

    // Development can access everything, use whitelist otherwise.
    // We allow undefined so the proxy requests get through as well.
    if (whitelist.includes(origin) || origin === undefined || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    }
    else {
      callback(`You cannot access the server from domain ${origin}.`);
    }
  },
  preflightContinue: true,
});
