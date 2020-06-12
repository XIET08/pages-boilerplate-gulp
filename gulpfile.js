// 实现这个项目的构建任务
const { src, dest, parallel, series } = require('gulp')

const minimist = require('minimist')
const del = require('del')
const browserSync = require('browser-sync')
const loadPlugins = require('gulp-load-plugins')

const argv = minimist(process.argv.slice(2))
const isProd = argv.production || argv.prod || false
const open = argv.open === undefined ? false : argv.open
const port = argv.port || 2080
const branch = argv.branch  === undefined ? 'gh-pages' : argv.branch

const plugins = loadPlugins()
const bs = browserSync.create()

const config = {
  build: {
      src: 'src',
      dist: 'dist',
      temp: 'temp',
      public: 'public',
      paths: {
          styles: 'assets/styles/*.scss',
          scripts: 'assets/scripts/*.js',
          pages: '*.html',
          images: 'assets/images/**',
          fonts: 'assets/fonts/**'
      }
  },
  data: {
    menus: [
      {
        name: 'Home',
        icon: 'aperture',
        link: 'index.html'
      },
      {
        name: 'Features',
        link: 'features.html'
      },
      {
        name: 'About',
        link: 'about.html'
      },
      {
        name: 'Contact',
        link: '#',
        children: [
          {
            name: 'Twitter',
            link: 'https://twitter.com/w_zce'
          },
          {
            name: 'About',
            link: 'https://weibo.com/zceme'
          },
          {
            name: 'divider'
          },
          {
            name: 'About',
            link: 'https://github.com/zce'
          }
        ]
      }
    ],
    pkg: require('./package.json'),
    date: new Date()
  }
}

const clean = () => {
  return del([config.build.dist, config.build.temp])
}

const scriptLint = () => {
  const { eslint } = plugins
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
}

const styleLint = () => {
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.stylelint({
        reporters: [
          {formatter: 'string', console: true}
        ],
        fix: true
    }))
}

const style = () => {
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src })
      .pipe(plugins.sass( { outputStyle : 'expanded' }))
      .pipe(dest(config.build.temp))
      .pipe(bs.reload({ stream: true }))
}

const script = () => {
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
      .pipe(plugins.babel( { presets: [require('@babel/preset-env')] } ))
      .pipe(dest(config.build.temp))
      .pipe(bs.reload({ stream: true }))
}

const page = () => {
  return src(config.build.paths.pages, { base: config.build.src, cwd: config.build.src })
  .pipe(plugins.swig( { data: config.data, defaults: { cache: false } }))
  .pipe(dest(config.build.temp))
  .pipe(bs.reload({ stream: true }))
}

const image = () => {
  return src(config.build.paths.images, { base: config.build.src, cwd: config.build.src })
      .pipe(plugins.imagemin())
      .pipe(dest(config.build.dist))
}

const font = () => {
  return src(config.build.paths.fonts, { base: config.build.src, cwd: config.build.src })
      .pipe(plugins.imagemin())
      .pipe(dest(config.build.dist))
}

const extra = () => {
  return src('**', { base: config.build.public, cwd: config.build.public })
      .pipe(dest(config.build.dist))
}

const useref = () => {
  return src(config.build.paths.pages, { base: config.build.temp, cwd: config.build.temp })
        .pipe(plugins.useref({ searchPath: [config.build.temp, '.', '..'] }))
        .pipe(plugins.if(
            /\.js$/,
            plugins.if(isProd, plugins.uglify())
        ))
        .pipe(plugins.if(
            /\.css$/,
            plugins.if(isProd, plugins.cleanCss())
        ))
        .pipe(plugins.if(
            /\.html$/,
            plugins.if(
                isProd,
                plugins.htmlmin({
                    collapseWhitespace: true,
                    minifyCSS: true,
                    minifyJS: true
                }))
            ))
        .pipe(dest(config.build.dist))
}

const serve = () => {
  watch(config.build.paths.styles, { cwd: config.build.src }, style)
  watch(config.build.paths.scripts, { cwd: config.build.src }, script)
  watch(config.build.paths.pages, { cwd: config.build.src }, page)

  watch([
    config.build.paths.images,
    config.build.paths.fonts,
  ], { cwd: config.build.src }, bs.reload)

  watch('**', { cwd: config.build.public }, bs.reload)

  bs.init({
      open: false,
      notify: false,
      port: 8080,
      // files: 'dist/**',
      server: {
          baseDir: [config.build.temp, config.build.src, config.build.public],
          routes: {
              '/node_modules': 'node_modules'
          }
      }
  })
}

const distServe = () => {
  bs.init({
    open,
    port,
    server: {
      baseDir: [config.build.dist]
    }
  })
}

const upload = () => {
    return src('**', { cwd: config.build.dist })
        .pipe(plugins.ghPages({
            branch
        }))
}

const lint = parallel(styleLint, scriptLint)

const compile = parallel(style, script, page)

const build = series(
  clean,
  parallel(
    series(compile, useref),
    image,
    font,
    extra
  )
)

const start = series(build, distServe)

const deploy = series(build, upload)

module.exports = {
  clean,
  lint,
  serve,
  build,
  compile,
  start,
  deploy
}
