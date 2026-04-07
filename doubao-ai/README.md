# shengtu

一个精简版前端生图页面（直连 Ark API）。

## 启动

```bash
npm install
npm start
```

浏览器打开：`http://localhost:3000`

## 当前保留内容

- `public/index.html` 页面结构
- `public/style.css` 页面样式
- `public/app.js` 前端逻辑（生成、单张重生、保存）
- `server.js` 最小静态服务
- `package.json` 最小依赖

## 说明

- 这是纯前端直连模式，API Key 会在浏览器侧使用并可见。
- 生成接口默认为 `https://ark.cn-beijing.volces.com/api/v3/images/generations`。
