# 火山引擎生图 Key 获取与配置教程（给生图同学）

面向对象：进行“原图 + 提示词”生图的同学。  
网址：`https://shengtu-dqf.pages.dev`

---

## 1. 准备API key

1. 注册并登录火山引擎：`https://www.volcengine.com/`
2. 完成实名认证（个人或企业）
3. 点击链接
https://console.volcengine.com/ark/region:ark+cn-beijing/model/detail?Id=doubao-seedream-5-0&Tab=model-info
4. 点击api接入并完成创建
<img width="1898" height="948" alt="image" src="https://github.com/user-attachments/assets/336a740f-2883-4557-8135-760b6e8008b4" />


## 2. 在生图页面里怎么填

打开页面后，核心只填这几项：

1. `API Key`：粘贴你创建的 ARK Key  
2. `API Base URL`：`https://ark.cn-beijing.volces.com/api/v3`  （已默认）  
3. `模型`：`doubao-seedream-5-0-260128`（已默认）  
4. 原图：本地上传 或 原图 URL 二选一  
5. 提示词：填几条就生成几张（空的不生成）

---

## 3. 常见报错与处理

### 3.1 `image format is not supported by the API`

原因：参考图格式不被接口接受。  
处理：
- 图片格式不正确；
- 换成 `png/jpg` 常见格式再试；
- 图片不要过大，必要时先压缩。

### 3.2 `401` / `Unauthorized`

原因：Key 错误、过期、被禁用。  
处理：
- 重新复制粘贴 Key；
- 到控制台确认 Key 状态是否可用；
- 尝试创建一把新的 Key。
