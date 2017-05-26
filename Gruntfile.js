module.exports = grunt => {
  // Load tasks
  grunt.loadNpmTasks('grunt-apidoc');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-nodemon');
  grunt.loadNpmTasks('grunt-preprocess');

  // Configure tasks
  grunt.initConfig({
    // Javascript linting
    jshint: {
      files: ['Gruntfile.js', 'server.js', 'public/**/*.js'],
      options: {
        esversion: 6,
        globals: {  // list of global variables and whether they are assignable
          angular: false
        },
        node: true, // tell jshint we are using nodejs to avoid incorrect errors
        unused: true
      }
    },
    // File watching
    watch: {
      js: {
        files: ['**/*.js'],
        tasks: ['jshint'],
        options: {
          spawn: false
        }
      }
    },
    // Live reload server (for local development)
    nodemon: {
      dev: {
        script: 'server.js'
      }
    },
    // Concurrently run the server and watch for file changes
    concurrent: {
      serve: {
        options: {
          logConcurrentOutput: true
        },
        tasks: ['nodemon', 'watch']
      }
    },
    // Execute shell commands
    exec: {
      publish: 'git checkout production && git merge master && git checkout master',
      deploy: {
        cmd: environment => {
          let checkout;
          
          if ('development' === environment) {
            checkout = 'master';
          }
          else if ('production' === environment) {
            checkout = 'production';
          }
          else {
            return '';
          }

          return `echo Checking out ${checkout} && git checkout ${checkout} && echo Deploying... && eb deploy && git checkout master`;
        }
      },
      commit: 'git add -u && git commit -m "automatic build commit"'
    },
    mochaTest: {
      test: {
        options: {
          timeout: 10000
        },
        src: ['tests/test.js']
      }
    },
    apidoc: {
      app: {
        src: "./",
        dest: "docs/",
        options: {
          includeFilters: [ ".*\\.js$" ],
          excludeFilters: [ "node_modules/" ]
          //debug: true
        }
      }
    },
    preprocess: {
      local: {
        files : {
          '.ebextensions/securelistener.config': '.ebextensions/securelistener.template.config.js'
        },
        options: {
          context: {
            ENV: 'local',
            SSL: 'false'
          }
        }
      },
      development: {
        files : {
          '.ebextensions/securelistener.config': '.ebextensions/securelistener.template.config.js'
        },
        options: {
          context: {
            ENV: 'development',
            SSL: 'false'
          }
        }
      },
      production: {
        files : {
          '.ebextensions/securelistener.config': '.ebextensions/securelistener.template.config.js'
        },
        options: {
          context: {
            ENV: 'production',
            SSL: 'true'
          }
        }
      }
    }
  });

  /* Register main tasks.
  **    grunt test            lints the js and executes mocha tests for the API
  **    grunt serve           lints the js, then locally serves the web app and simultaneously watch for file changes for linting
  **    grunt publish         runs tests, then merges development branch into production
  **    grunt deploy:env      builds the current branch, tests, and deploys to the specified environment
  **                          (either "development" or "production"), merging into production if needed.
  */
  grunt.registerTask('test', ['jshint', 'mochaTest']);
  grunt.registerTask('serve', ['apidoc', 'jshint', 'preprocess:local', 'concurrent:serve']);
  grunt.registerTask('publish', ['apidoc', 'test', 'preprocess:production', 'exec:commit', 'exec:publish']);
  grunt.registerTask('deploy:development', ['apidoc', 'test', 'preprocess:development', 'exec:commit', 'exec:deploy:development']);
  grunt.registerTask('deploy:production', ['publish', 'exec:deploy:production']);
  grunt.registerTask('default', ['serve']);
};
