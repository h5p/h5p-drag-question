var path = require('path');
const nodeEnv = process.env.NODE_ENV || 'development';
const libraryName = process.env.npm_package_name;

module.exports = {
  mode: nodeEnv,
  context: path.resolve(__dirname, 'src'),
  entry: './drag-question.js',
  devtool: (nodeEnv === 'production') ? undefined : 'inline-source-map',
  output: {
    filename: `${libraryName}.js`,
    path: path.resolve(__dirname, '.')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }
    ]
  },
  stats: {
    colors: true
  }
};
