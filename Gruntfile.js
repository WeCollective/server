module.exports = grunt => {
  // Load tasks
  grunt.loadNpmTasks('grunt-apidoc');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-nodemon');

  // Configure tasks
  grunt.initConfig({
    // File watching
    watch: {
      js: {
        files: ['**/*.js'],
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

          return `echo "Checking out ${checkout}" && git checkout ${checkout} && echo "Deploying..." && eb deploy && git checkout master`;
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
        src: './',
        dest: 'docs/',
        options: {
          includeFilters: [ '.*\\.js$' ],
          excludeFilters: [ 'node_modules/' ]
          //debug: true
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
  grunt.registerTask('test', ['mochaTest']);
  grunt.registerTask('serve', ['apidoc', 'concurrent:serve']);
  grunt.registerTask('publish', ['apidoc', 'test', 'exec:commit', 'exec:publish']);
  grunt.registerTask('deploy:dev', ['apidoc', 'test', 'exec:commit', 'exec:deploy:development']);
  grunt.registerTask('deploy:production', ['publish', 'exec:deploy:production']);
  grunt.registerTask('default', ['serve']);
};
