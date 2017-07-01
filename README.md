# @mora/tinypng

基于 [TinyPNG](https://tinypng.com/) 封装的一个支持`nodejs`、`命令行` 和`webpack`的图片压缩工具

## 支持压缩的图片格式

* png
* jpg/jpeg
* svg (TinyPNG 不支持压缩 svg，所以在 `@mora/tinypng` 中使用了 `svgo` 来压缩)

## 背景

  当前市面上有很多图片压缩工具，但[TinyPNG](https://tinypng.com/)是我目前所遇到的在保证压缩质量的前提下
  压缩效率最好的一款压缩工具。官方解释说：

  > TinyPNG uses smart lossy compression techniques to reduce the file size of your PNG files.
  > By selectively decreasing the number of colors in the image, fewer bytes are required to
  > store the data. The effect is nearly invisible but it makes a very large difference in
  > file size!

  不过 TinyPNG 并没有开源，所以它的具体压缩算法不得而知，我们只能通过调用它提供的 API 来压缩图片，而每个月每
  个帐户只能调用 500 次它的 API，如果想调用更多次数，你需要付费升级你的帐户。

  **所以，为了可以得到 TinyPNG 高效率压缩的图片，同时又希望无限制的免费调用它的 API，就有了此工具**

## 原理

  前提：需要用户手动去[TinyPNG官网](https://tinypng.com/)注册（注册很简单，只要邮箱就行了）多个帐户，获取到每个帐户的 token，提供给此程序

  程序会循环使用用户提供的 token 去调用官方 API，所以，你提供的 token 越多，每个月可以调用 TinyPNG 的 API 的次数就越多，也就基本上可以算是可以无限制的使用它的 API 了；同时如果开启缓存，在有缓存的情况下就不会去调用官方 API，直接使用缓存，大大提高了效率，也节省了 API 使用次数

## 使用

### 在`nodejs`中使用

```js
import {Tinypng} from '@mora/tinypng'

let tinypng = new Tinypng({
  tokens: ['...', '...', '...']
})

tinypng.tiny('/path/to/some/image/file') // 此处也可以提供文件 Buffer
  .then((minifiedBuffer) => {
    // your code
  })
```

<a id="base-options"></a>

#### 构造函数 Tinypng 的选项

| 字段           | 类型       |  说明  |
| --------      | -----      | ---- |
| tokens        | `string[]` |  在官网上注册后取到的 token  |
| cacheDir      | `string`   |  缓存压缩后的图片的文件夹，避免重复去 TinyPNG 官网压缩 |
| recordFile    | `string`   |  tokens 使用情况的记录文件，程序会根据此文件来得知哪些 token 过期了 |
| svgo          | `object`   |  svgo 配置项，用于压缩 svg 文件，参考 https://github.com/svg/svgo |
| proxy         | `string`   |  指定代理服务器，比如 "http://user:pass@192.168.0.1:8080" |
| resize        | `object`   |  调整图片尺寸，指定了此选项就不会压缩图片，参考 https://tinypng.com/developers/reference/nodejs#resizing-images |


### 在`命令行`中使用

```bash
# 先全局安装脚本
npm i -g @mora/tinypng

# 使用
## 注意，图片文件名不要放在 --tokens 后面，否则会把图片名字当作 token 处理了
tinypng /path/to/image1 /path/to/image2  --tokens token1 token2
```

如果不想每次都在命令行上带参数，可以使用配置文件，程序默认会在 『当前目录』，『第一个含有 package.json 的父级目录』，
『当前系统用户的 HOME 目录』三个目录中按顺序查找 tinypng-config.js 或 tinypng-config.json 文件，以第一个找到
的文件为准；当然你也可以通过在命令行上用 `--config` 参数来指定配置文件的路径，比如：

```base
tinypng --config /path/to/config/file  /path/to/image1
```

#### 命令行上可以使用的选项
除了支持所有上面 [构造函数 Tinypng 的选项](#base-options) 中指定的参数外，还支持下面几个：

| 字段           | 类型       |  说明  |
| --------      | -----      | ---- |
| config        | `string`   |  指定配置文件  |
| backupDir     | `string`   |  备份目录，源文件会保存在这里，压缩后的文件会覆盖原源文件  |
| outputDir     | `string`   |  输出目录, 源文件不会改变，压缩后的文件会保存在此 |

**"backupDir" 和 "outputDir" 只需要设置一个即可，系统会优先使用 "outputDir"，如果两个都没设置，则会直接替换原文件（你可以大胆的相信 TinyPNG 的压缩质量）**


更多详情可以使用 `tinypng -h` 来查看

### 在`webpack`中使用

```js
const TinypngWebpackPlugin = require('@mora/tinypng').TinypngWebpackPlugin

...
  plugins: [
    new TinypngWebpackPlugin({/* options here */})
  ]
...
```

#### 在webpack中的配置
一样支持所有上面 [构造函数 Tinypng 的选项](#base-options) 中指定的参数，同时支持命令行模块中提到的配置文件 tinypng-config.js 或 tinypng-config.json，另外还支持一个 `filter` 参数

| 字段           | 类型       |  说明  |
| --------      | -----      | ----- |
| config        | `string`   |  指定配置文件  |
| filter        | `function` |  过滤出可以压缩的 module 来 |


## TODO LIST

* [ ] 自动注册帐户获取 token
