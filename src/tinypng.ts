import * as tinify from 'tinify'
import * as fs from 'fs-extra'
import * as path from 'path'

import * as warn from 'mora-scripts/libs/sys/warn'
import * as SVGO from 'svgo'

import TokenPicker from 'mora-common/feature/TokenPicker'

import {hash, isNetFile, isSvgFile, writeFileSync} from './helper'

export type ITinypngSource = string | Buffer
export type ITinypngTarget = string

export interface ITinypngProcessOption {
  /**
   * tinypng 在国内可能需要翻墙，这里可以指定代理
   * 比如："http://user:pass@192.168.0.1:8080"
   */
  proxy?: string
  /**
   * https://tinypng.com/developers/reference/nodejs#resizing-images
   *
   * method=scale: 还需要设置一个 width 或 height，程序会等比缩放到指定的 width 或 height
   * method=fit:   需要同时指定 width 和 height，图片可能变形
   * method=cover: 需要同时指定 width 和 height，程序会根据指定的宽高自动截取重要的区域
   */
  resize?: {
    method: 'fit' | 'scale' | 'cover'
    width?: number
    height?: number
  },

  /**
   * svgo 配置项，用于压缩 svg 文件
   * 参考：https://github.com/svg/svgo
   */
  svgo?: any
}

export interface ITinypngOption extends ITinypngProcessOption {
  /**
   * 存储处理后的文件，避免对一个文件重复处理，浪费 token 使用次数，同时也节省时间
   */
  cacheDir?: string
  /**
   * 存储 tokens 使用信息的文件
   */
  recordFile?: string

  tokens: string[]
}

export default class {
  private tp: TokenPicker
  private svgo: SVGO
  private fakeTokenMap: any = {}

  constructor(public option: ITinypngOption) {
    let fakeTokens = option.tokens.map(token => {
      let fake = 'fake-' + hash(token)
      this.fakeTokenMap[fake] = token
      return fake
    })

    if (option.recordFile && !fs.existsSync(option.recordFile)) {
      writeFileSync(option.recordFile, '{}')
    }

    this.tp = new TokenPicker(fakeTokens, option)
    this.svgo = new SVGO(option.svgo || {plugins: [{removeTitle: true}]})
  }

  // tiny(source: ITinypngSource, option?: ITinypngProcessOption): Promise<Buffer>
  tiny(source: ITinypngSource, target?: ITinypngTarget | ITinypngProcessOption, option?: ITinypngProcessOption): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (typeof target === 'object') {
        option = target
        target = null
      }
      option = Object.assign({}, this.option, option)

      let cacheFn
      let sourceBuffer = Buffer.isBuffer(source) ? source : null

      if (typeof source === 'string' && !isNetFile(source)) {
        sourceBuffer = fs.readFileSync(source)

        // svg 文件用 svgo 压缩，svg 无需缓存
        if (isSvgFile(source)) {
          let svgo = option.svgo !== this.option.svgo ? new SVGO(option.svgo) : this.svgo
          return svgo.optimize(sourceBuffer.toString(), (rtn) => {
            if (rtn.data) this.tinySuccess(new Buffer(rtn.data), target, resolve, reject)
            else reject(rtn)
          })
        }
      }

      let cacheDir = this.option.cacheDir
      if (cacheDir && sourceBuffer) {
        let cacheBuffer = getCache(cacheDir, sourceBuffer)
        if (cacheBuffer) return this.tinySuccess(cacheBuffer, target, resolve, reject)

        cacheFn = (destBuffer: Buffer) => setCache(cacheDir, sourceBuffer, destBuffer)
      }

      try {
        this.tp.do((token, expire) => {
          (tinify as any).key = this.fakeTokenMap[token]
          tinypngProcess(this.fakeTokenMap[token], source, option)
            .then(buffer => {
              if (cacheFn) cacheFn(buffer)
              this.tinySuccess(buffer, target, resolve, reject)
            })
            .catch(e => this.tinyFailed(e, expire, resolve, reject))
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  private tinySuccess(buffer: Buffer, target, resolve, reject) {
    if (!target) resolve(buffer)
    fs.writeFile(target, buffer, (err) => {
      if (err) reject(err)
      else resolve(buffer)
    })
  }

  private tinyFailed(e, expire, resolve, reject) {
    if (e instanceof tinify.AccountError) {
      warn(e.message)
      let d = new Date()
      expire(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime())
    } else {
      reject(e)
    }
  }
}

function getCache(cacheDir: string, buffer: Buffer): Buffer {
  try {
    let file = path.join(cacheDir, hash(buffer))
    let stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) file = fs.readlinkSync(file)
    return fs.readFileSync(file)
  } catch (e) {}
}

function setCache(cacheDir: string, srcBuffer: Buffer, destBuffer: Buffer): void {
  let srcFile = path.join(cacheDir, hash(srcBuffer))
  let destFile = path.join(cacheDir, hash(destBuffer))

  writeFileSync(destFile, destBuffer)
  if (srcFile !== destFile) fs.symlinkSync(destFile, srcFile)
}

function tinypngProcess(token: string, source: ITinypngSource, option: ITinypngProcessOption): Promise<Buffer> {
  let {proxy, resize} = option
  Object.assign(tinify, {key: token, proxy})

  let tinySource
  if (typeof source === 'string') {
    if (isNetFile(source)) {
      tinySource = tinify.fromUrl(source)
    } else {
      tinySource = tinify.fromFile(source)
    }
  } else {
    tinySource = tinify.fromBuffer(source)
  }

  if (resize) tinySource = tinySource.resize(resize)

  return new Promise((resolve, reject) => {
    tinySource.toBuffer((err, buffer) => {
      if (err) {
        reject(err)
      } else {
        resolve(buffer)
      }
    })
  })
}
