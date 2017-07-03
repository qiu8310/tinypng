#!/usr/bin/env node

import * as cli from 'mora-scripts/libs/tty/cli'
import * as table from 'mora-scripts/libs/tty/table'
import * as clog from 'mora-scripts/libs/sys/clog'
import pretty from 'mora-common/util/prettyBytes'
import * as path from 'path'
import * as fs from 'fs-extra'

import {getConfig, isSvgFile, writeFileSync, runProgressTasks} from './helper'
import Tinypng from './tinypng'

const color = clog.format

cli({
  usage: 'tinypng [options]  <file1, file2, file3, ...>',
  version: require('../package.json').version,
  desc: [
  color(`%c配置文件示例（配置文件中，如果是相对目录，则是相对于当前配置文件所在的文件夹的目录）
  {
    "tokens": ["...", "..."],                       %c必需设置%c
    "cacheDir": "/path/to/another/directory",       %c推荐设置，并且加入 git 版本控制%c
    "recordFile": "/path/to/some/file",             %c推荐设置，并且不要加入 git 版本控制%c
    "backupDir": "/path/to/backup/directory",
    "outputDir": "/path/to/output/directory",
    "proxy": "http://user:pass@192.168.0.1:8080",
    "resize": {
      "method": 'fit' | 'scale' | 'cover'
      "width": number
      "height": number
    }
  }`, 'gray',
    'red', 'reset.gray',
    'green', 'reset.gray',
    'green', 'reset.gray'
  )
  ]
})
.options({
  'config': '<string> 配置文件路径，默认是在『当前目录』、『package.json目录』、『用户 home 目录』中第一次出现的： ./tinypng-config.js 或 tinypng-config.json 文件',
  'b | backupDir': '<string> 备份目录，源文件会保存在这里，压缩后的文件会覆盖原源文件【命令行程序专有的配置】',
  'o | outputDir': '<string> 输出目录, 源文件不会改变，压缩后的文件会保存在此；"backupDir" 和 "outputDir" 只需要设置一个即可，优先使用 "outputDir"【命令行程序专有的配置】',
  'c | cacheDir': '<string> 缓存 tinypng 处理后的文件，避免重复处理，节省 api 调用次数',
  't | tokens': '<string> tinypng 需要使用的 token，多个 token 请用逗号分隔，可以在官网 https://tinypng.com/ 用邮箱注册即可得到',
  'r | recordFile': '<string> 记录文件，记录 token 使用或过期情况，给系统用的，对用户无意义，推建设置',
  'p | proxy': '<string> 使用 tinypng 可能要翻墙，可以在此设置代理',
  'resize': '<string> resize 图片，参数格式: "method|width|height"，注意：使用了此选项不会对图片压缩',
  'quiet': '<bool> 不输出 tinypng 压缩进度信息，但仍然会输出压缩结果'
})
.parse(
  function(res) {
    let config = getConfig(res)

    if (!config._.length) {
      return this.error('No input files')
    }

    // svg 文件不需要 token
    if ((!config.tokens || !config.tokens.length) && !config._.every(file => isSvgFile(file))) {
      return this.error('No available tokens')
    }

    let tinypng = new Tinypng({
      tokens: config.tokens,
      recordFile: config.recordFile,
      cacheDir: config.cacheDir,
      proxy: config.proxy,
      resize: config.resize
    })

    let tableDataMap = {}
    let callback = () => {
      let head = [['File', 'Original Size', 'Tinified Size', 'Tinified Rate'].map(l => color(`%c${l}`, 'white.bold'))]
      let data = head.concat(config._.map(file => tableDataMap[file]))
      console.log()
      console.log(table(data.map(list => list.map(item => '  ' + item))))
      console.log()
    }

    let cwd = process.cwd()
    runProgressTasks(
      config._.map(file => done => {
        let key = path.relative(cwd, file)
        let srcBuffer = fs.readFileSync(file)
        let original = srcBuffer.length

        tinypng.tiny(file)
          .then(destBuffer => {
            let tinified = destBuffer.length
            let rate = Math.round((original - tinified) * 100 / original)
            tableDataMap[file] = [key, pretty(original), pretty(tinified), color(`%c${rate + '%'}`, rate > 50 ? 'red' : rate > 25 ? 'yellow' : rate > 0 ? 'green' : 'gray')]

            if (config.outputDir) {
              // 目录结果扁平
              writeFileSync(path.join(config.outputDir, path.basename(key)), tinified < original ? destBuffer : srcBuffer)
            } else {
              if (config.backupDir) {
                // 目录结构保持和原文件的目录结果一致
                writeFileSync(path.join(config.backupDir, key).replace(/\.\./g, '.'), srcBuffer)
              }
              if (tinified < original) {
                writeFileSync(file, destBuffer)
              }
            }
            done(file)
          })
          .catch(e => {
            tableDataMap[file] = [key, pretty(original), '--', '--']
            console.error(e)
            done(file)
          })
        return file

      }),
      callback,
      {
        indent: '  ',
        quiet: config.quiet === true
      }
    )
  }
)
