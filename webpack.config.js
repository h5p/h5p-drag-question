var path = require('path');

module.exports = {
  entry: './src/drag-question.js',
  output: {
    filename: 'h5p-drag-question.js',
    path: path.resolve(__dirname, '.')
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader'
      }
    ]
  }
};
