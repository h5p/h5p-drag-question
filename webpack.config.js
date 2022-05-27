var path = require('path');

module.exports = {
  entry: './src/drag-question.js',
  output: {
    filename: 'h5p-drag-question.js',
    path: path.resolve(__dirname, '.')
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      }
    }]
  }
};
