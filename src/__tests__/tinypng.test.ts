jest.mock('tinify', () => {
  let fs = require('fs')
  let path = require('path')
  class TinySource {
    constructor(public type, public resource) {}
    resize() { this.type = 'resize'; return this }
    toBuffer(callback) {
      let file
      switch (this.type) {
        case 'resize': file = 'image-resized.png'; break
        case 'url': file = 'url.png'; break
        case 'file': file = 'image.' + this.resource.split('.').pop(); break
        case 'buffer': file = 'buffer.png'; break
        default: return callback(new Error('Not supported in mock'))
      }

      // 提了个问题在 https://github.com/facebook/jest/issues/2567#issuecomment-312479895
      let dirname = '/Users/Mora/Workspace/node/tinypng/src/__tests__'
      return callback(null, fs.readFileSync(path.join(dirname, 'fixtures', 'minified', file)))
    }
  }
  return {
    fromUrl(url) { return new TinySource('url', url) },
    fromFile(file) { return new TinySource('file', file) },
    fromBuffer(buffer) { return new TinySource('buffer', buffer) }
  }
})
import * as fs from 'fs-extra'
import * as path from 'path'
import Tinypng from '../tinypng'

const fixturesDir = path.join(__dirname, 'fixtures')
const unminifiedFile = (name = '') => path.join(fixturesDir, 'unminified', name)
const minifiedFile = (name = '') => path.join(fixturesDir, 'minified', name)

// const tokens = require('../../tinypng-tokens.json')
const tokens = ['fake1']
const netFile = 'https://cdn.tinypng.com/images/example-orig.png'

describe('tinypng', () => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 2000
  test('tiny svg', () => {
    return testMinFile('image.svg')
  })
  test('tiny jpg', () => {
    return testMinFile('image.jpg')
  })
  test('tiny png', () => {
    return testMinFile('image.png')
  })
  test('tiny buffer', () => {
    let srcBuffer = fs.readFileSync(unminifiedFile('image.png'))
    return new Tinypng({tokens})
      .tiny(srcBuffer)
      .then(buffer => {
        expect(buffer.length).toBeLessThanOrEqual(srcBuffer.length)
        expectBufferEqualsTo(buffer, 'buffer.png')
      })
  })
  test('tiny url file', () => {
    return new Tinypng({tokens})
      .tiny(netFile)
      .then(buffer => {
        expect(buffer.length).toBeLessThan(56907)
        expectBufferEqualsTo(buffer, 'url.png')
      })
  })
  test('tiny resize', () => {
    return new Tinypng({tokens})
      .tiny(unminifiedFile('image.png'), {resize: {method: 'cover', width: 10, height: 10}})
      .then(buffer => expectBufferEqualsTo(buffer, 'image-resized.png'))
  })

  test('tiny target', () => {
    let target = path.join(fixturesDir, 'target.png')
    return new Tinypng({tokens})
      .tiny(unminifiedFile('image.png'), target)
      .then(buffer => {
        expect(fs.statSync(target).isFile()).toBe(true)
        fs.removeSync(target)
      })
  })

  test('tiny option recordFile', () => {
    let recordFile = path.join(fixturesDir, 'log.json')
    return new Tinypng({tokens, recordFile})
      .tiny(unminifiedFile('image.png'))
      .then(buffer => {
        expect(fs.statSync(recordFile).isFile()).toBe(true)
        fs.removeSync(recordFile)
      })
  })

  test('tiny option cacheDir', () => {
    let cacheDir = path.join(fixturesDir, 'cache')
    let tp = new Tinypng({tokens, cacheDir})
    fs.removeSync(cacheDir)

    return tp.tiny(unminifiedFile('image.png'))
      .then(buffer => {
        expect(fs.statSync(cacheDir).isDirectory()).toBe(true)
        expect(fs.readdirSync(cacheDir).length).toBe(2)

        return Promise.all([
          tp.tiny(unminifiedFile('image.png')).then(b => {
            expect(fs.readdirSync(cacheDir).length).toBe(2) // 压缩原始文件，缓存文件没有变化
          }),
          tp.tiny(buffer).then(b => {
            expect(fs.readdirSync(cacheDir).length).toBe(2) // 压缩压缩后的文件，缓存文件没有变化
          }),
          tp.tiny(unminifiedFile('image.svg')).then(b => {
            expect(fs.readdirSync(cacheDir).length).toBe(2) // 压缩 svg 文件，缓存文件没有变化
          }),
        ])
      })
      .then(() => {
        tp.tiny(unminifiedFile('image.jpg'))
          .then(buffer => {
            expect(fs.readdirSync(cacheDir).length).toBe(4) // 新的文件，新增缓存
          })
      })
      .then(() => fs.removeSync(cacheDir))
  })

  function testMinFile(filename) {
    return new Tinypng({tokens})
        .tiny(unminifiedFile(filename))
        .then(buffer => {
          expect(buffer.length).toBeLessThanOrEqual(fs.readFileSync(unminifiedFile(filename)).length)
          expectBufferEqualsTo(buffer, filename)
        })
  }

  function expectBufferEqualsTo(buffer: Buffer, file: string) {
    return expect(buffer.equals(fs.readFileSync(minifiedFile(file))))
  }
})
