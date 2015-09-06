'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' All rights reserved. */',
    // Task configuration.
    usebanner: {
      dist: {
        options: {
          position: 'bottom',
          banner: '<%= banner %>'
        },
        files: {
          src: [ 'lib/**/*.js' ]
        }
      },
      tasks: {
        options: {
          position: 'bottom',
          banner: '<%= banner %>\n' +
            'require(\'source-map-support\').install();',
        },
        files: {
          src: [ 'tasks/**/*.js' ]
        }
      },
    },
    coffee: {
      glob_to_multiple: {
        options: {
          sourceMap: true
        },
        expand: true,
        flatten: false,
        cwd: 'src/',
        src: ['**/*.coffee'],
        dest: 'lib/',
        ext: '.js'
      },
      tasks: {
        options: {
          sourceMap: true,
        },
        expand: true,
        flatten: false,
        cwd: 'tasks/',
        src: ['**/*.coffee'],
        dest: 'tasks/',
        ext: '.js'
      }
    },
    coffeelint: {
      dist: {
        options: grunt.file.readJSON('coffeelint.json'),
        files: {
          src: [ 'src/**/*.coffee', '!src/__simpleREST/swagger-jack-*' ]
        }
      }
    },
    watch: {
      scripts: {
        files: [ "**/*.coffee" ],
        tasks: ['default']
      }
    },
    copy: {
      main: {
        files: [
          {expand: true, cwd:'swagger-ui/dist/', src: ['**'], dest: 'lib/swagger-ui/'},
        ]
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-banner');
  grunt.loadNpmTasks('grunt-contrib-coffee');
  grunt.loadNpmTasks('grunt-coffeelint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // Default task.
  grunt.registerTask('default', [ 'coffeelint', 'coffee', 'usebanner', "copy"]);

};
