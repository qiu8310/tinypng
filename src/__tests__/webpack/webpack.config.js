const path = require('path')
const fs = require('fs-extra')
const webpack = require('webpack')
const TinypngWebpackPlugin = require('../../../lib/index').TinypngWebpackPlugin

let root = path.resolve(__dirname)
let out = path.join(root, 'out')
fs.emptyDirSync(out)

module.exports = {
  entry: {
    index: path.join(root, 'index.js')
  },
  output: {
    path: out,
    publicPath: '',
    filename: '[name].js'
  },
  plugins: [
    new TinypngWebpackPlugin({tokens: require('../../../tinypng-tokens.json')}),
    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  module: {
    rules: [
      {test: /\.(gif|png|jpg|jpeg|svg)$/, use: 'url-loader?limit=1024&name=[hash].[ext]'}
    ]
  }
}
