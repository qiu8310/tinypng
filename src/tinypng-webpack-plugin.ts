import {RawSource} from 'webpack-sources'

import {default as Tinypng, ITinypngOption} from './tinypng'
import {getConfig, runProgressTasks} from './helper'

export interface IWebpackModule {
  dependencies: any[]
  context: string
  request: string
  userRequest: string
  rawRequest: string
  resource: string
  fileDependencies: any[]
  assets: any
  cacheable: boolean
}

export declare type IFilter = (m: IWebpackModule) => boolean

export interface ITinypngWebpackOption extends ITinypngOption {
  /**
   * 过滤出你需要使用压缩的 module，默认是压缩带 png/jpg/jpeg/svg 后缀的文件
   */
  filter?: IFilter,
  /**
   * 是否不需要输出 tinypng 的压缩进度
   */
  quiet?: boolean
}

export default class TinypngWebpackPlugin {
  tp: Tinypng
  filter: IFilter

  constructor(public options: ITinypngWebpackOption) {
    options = getConfig(options)
    if (!options.tokens || !Array.isArray(options.tokens) || options.tokens.length === 0) throw new Error('No tokens option')
    this.tp = new Tinypng(options)

    this.filter = options.filter || function(m) {
      return m.rawRequest && /\.(png|jpg|jpeg|svg)$/i.test(m.resource)
    }
  }

  apply(compiler) {
    let self = this

    compiler.plugin('compilation', function(compilation) {
      compilation.plugin('optimize-assets', function(assets, callback) {
        interface IOptimizeFile {
          rawRequest: string
          assetKey: string
          asset: any
        }

        let optimizeFiles: IOptimizeFile[] = []
        this.modules.forEach((m: IWebpackModule) => {
          let moduleAssets = Object.keys(m.assets)
          if (moduleAssets.length === 1 && self.filter(m)) {
            optimizeFiles.push({
              rawRequest: m.rawRequest,
              assetKey: moduleAssets[0],
              asset: m.assets[moduleAssets[0]]
            })
          }
        })

        runProgressTasks(
          optimizeFiles.map(file => done => {
            self.tp.tiny(file.asset.source())
              .then(buffer => {
                compilation.assets[file.assetKey] = new RawSource(buffer)
                done(file.rawRequest)
              })
              .catch(e => {
                compilation.errors.push(e instanceof Error ? e : new Error(JSON.stringify(e)))
                done(file.rawRequest)
              })
            return file.rawRequest
          }),
          callback,
          {
            indent: '',
            quiet: self.options.quiet
          }
        )
      })
    })
  }
}
