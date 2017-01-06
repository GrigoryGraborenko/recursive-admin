var gulp = require('gulp');
var concat = require('gulp-concat');
var rename = require('gulp-rename');

var streamqueue = require('streamqueue');

var uglify = require('gulp-uglify');
var gulpLoadPlugins = require('gulp-load-plugins');
var plugins = gulpLoadPlugins();

var browserify = require('browserify');

var babel = require('gulp-babel');
var babelify = require('babelify');

var source = require('vinyl-source-stream');

var watchify = require('watchify');

var es = require('event-stream');

var reactComponents = [
    'src/GrigoryGraborenko/RecursiveAdmin/Resources/js/react/admin.jsx'
];

gulp.task('default', function () {
    gulp.start('all');
});

function jsx(watch) {
    function getBundleFn(bundler, filename) {
        return function() {
            console.log('building: ' + filename);
            return bundler
                .bundle()
                .on('error', function(err) {
                    console.log(err.message);
                    this.emit('end');
                })
                .pipe(source(filename)) //convert file stream to vinyl fs format
                .pipe(rename(function(path) {
                    path.dirname += '/dist'; //place bundle in dist subdir with .bundle suffix
                    path.extname = '.js';
                }))
                .pipe(gulp.dest('.'));
        }
    }

    var bundleTasks = reactComponents.map(function(entry) {
        var bundler = browserify({entries : entry })
            .transform(babelify, {presets: ["es2015", "react"]});

        if(watch) {
            bundler = watchify(bundler, {poll: true});
        }

        var bundleFn = getBundleFn(bundler, entry);

        bundler.on('update', bundleFn);
        bundler.on('log', console.log);

        return bundleFn();

    });
    return es.merge.apply(null, bundleTasks);
}

gulp.task('jsx', function() {
    return jsx(false);
});

gulp.task('jsx-watch', function() {
    return jsx(true);
});

// Do common tasks
gulp.task('all', function() {
    gulp.start('jsx');
});

// Watch changing files and update as necessary.
gulp.task('watch', function () {
    gulp.start('jsx-watch');
});