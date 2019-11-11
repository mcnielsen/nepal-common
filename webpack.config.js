const path = require('path');
const nodeExternals = require("webpack-node-externals" );
const copyWebpackPlugin = require("copy-webpack-plugin" );

module.exports = {
  mode: 'production',
  target: 'node',
  entry: {
    'index': path.resolve( __dirname, './dist/commonjs/index.js' ),
  },
  externals: [ nodeExternals() ],
  output: {
    path: path.resolve(__dirname, './dist/umd'),
    filename: '[name].js',
    library: '@al/common',
    libraryTarget: 'umd', // supports commonjs, amd and web browsers
    globalObject: 'this'
  },
  plugins: [
    new copyWebpackPlugin( [
      { from: './config', to: '../config', toType: 'dir' }
    ] )
  ]
};
