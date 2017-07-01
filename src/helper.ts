import * as crypto from 'crypto'

import * as findup from 'mora-scripts/libs/fs/findup'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as logUpdate from 'log-update'

const NET_FILE_REGEXP = /^\w+:\/\//
const SVG_FILE_REGEXP = /\.svg$/i
const homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']
const pkgRoot = (function() {
  try {
    return path.dirname(findup.pkg())
  } catch (e) {
    return process.cwd()
  }
})()

export function hash(data: string | Buffer, algorithm: string = 'md5') {
  let hash = crypto.createHash(algorithm)
  hash.update(data)
  return hash.digest('hex')
}

/**
 * 如果没有指定 configFile，则分别从『当前目录』、『项目根目录』、『用户目录』查找 defaultConfigFileName 对应的文件
 */
function getConfigFromFile(defaultConfigFileName: string, configFile?: string): any {
  let result: any = {}

  if (configFile) {
    result = require(configFile)
    result.configDir = path.dirname(configFile)
  } else {
    [process.cwd(), pkgRoot, homeDir].some(dir => {
      try {
        result = require(path.join(dir, defaultConfigFileName))
        result.configDir = dir
        return true
      } catch (e) {}
    })
  }

  return result
}

/**
 * resize 参数支持格式 method|width|height ， 方便在命令行上使用
 */
function parseConfigResize(resize: string): any {
  if (typeof resize !== 'string') return resize

  let [method, width, heigth] = resize.split(/\s*|\s*/)
  let result: any = {}
  result.method = method

  if (width) result.width = parseInt(width, 10)
  if (heigth) result.heigth = parseInt(heigth, 10)
  return result
}

/**
 * 根据用户配置的信息或者命令行里的参数得到 tinypng 需要的选项
 */
export function getConfig(options: any = {}) {
  let config = getConfigFromFile('tinypng-config', options.config)

  Object.keys(options).forEach(key => {
    // 命令行上的配置优先级最高，另外命令行上如果没设置 options[key] 会是 undefined
    if (options.hasOwnProperty(key) && options[key] !== undefined) config[key] = options[key]
  })
  Object.keys(config).forEach(key => {
    // 目录相关的选项使用相对于配置文件的绝对路径
    if (config.configDir && /(Dir|File)$/.test(key)) config[key] = path.resolve(config.configDir, config[key])
  })
  if (config.resize) config.resize = parseConfigResize(config.resize)
  return config
}

/**
 * 判断文件是否是在线的文件
 */
export function isNetFile(file: string): boolean {
  return NET_FILE_REGEXP.test(file)
}

export function isSvgFile(file: string): boolean {
  return SVG_FILE_REGEXP.test(file)
}

export function writeFileSync(filepath: string, buffer: Buffer | string) {
  fs.ensureDirSync(path.dirname(filepath))
  fs.writeFileSync(filepath, buffer)
}

export function runProgressTasks(tasks: any[], callback, {indent = ''} = {}) {
  let total = tasks.length
  if (total === 0) return callback()

  let frames = ['-', '\\', '|', '/']
  let frameIndex = 0
  let currentAction = ''
  let currentFilename = ''
  let finishedCount = 0

  let refresh = () => {
    let field = currentFilename ? `${currentAction}${currentFilename}` : ''
    logUpdate(`${indent}Tinypng processing ${frames[frameIndex = ++frameIndex % frames.length]}  ${field}`)
  }

  let sid = setInterval(refresh, 80)

  // let bar = new ProgressBar(indent + 'Tinypng: :bar :percent :name', {total: total + 1, width: 20})
  let next = (name) => {
    currentAction = 'done '
    currentFilename = name
    finishedCount++

    if (finishedCount === total) {
      logUpdate.clear()
      clearInterval(sid)
      callback()
    }
  }

  tasks.forEach(task => {
    currentAction = 'doing '
    currentFilename = task(next)
  })
  refresh()
}
