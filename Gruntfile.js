module.exports = function(grunt) {
  // Load tasks
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-nodemon');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-mocha-test');

  // Configure tasks
  grunt.initConfig({
    // javascript linting
    jshint: {
      files: ['Gruntfile.js', 'server.js', 'public/**/*.js'],
      options: {
        node: true, // tell jshint we are using nodejs to avoid incorrect errors
        globals: {  // list of global variables and whether they are assignable
          "angular": false
        }
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
    // concurrently run the server and watch for file changes
    concurrent: {
      serve: {
        options: {
          logConcurrentOutput: true
        },
        tasks: ['nodemon', 'watch']
      }
    },
    // execute shell commands
    exec: {
      publish: 'git checkout production && git merge master && git checkout master',
      deploy: {
        cmd: function(environment) {
          var checkout;
          if(environment == 'development') {
            checkout = 'master';
          } else if(environment == 'production') {
            checkout = 'production';
          } else {
            return '';
          }
          return 'echo Checking out ' + checkout + ' && git checkout ' + checkout + ' && echo Deploying... && eb deploy && git checkout master';
        }
      }
    },
    mochaTest: {
      test: {
        src: ['tests/test.js']
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
  grunt.registerTask('serve', ['jshint', 'concurrent:serve']);
  grunt.registerTask('publish', ['test', 'exec:publish']);
  grunt.registerTask('deploy:development', ['test', 'exec:deploy:development']);
  grunt.registerTask('deploy:production', ['publish', 'exec:deploy:production']);
};
