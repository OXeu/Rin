# 部署

## 其他文档
[环境变量列表](./ENV.md)

>[!TIP]
> 下文代码块中若出现形如 <文字> 的内容表示需要根据文字提示替换为自己的内容（`<`和`>`不要保留），如：
> ```
> bun wrangler d1 create <数据库名称>
> ```
> 表示将 <数据库名称> 替换为你喜欢的名称，这里使用 rin替换：
> ```
> bun wrangler d1 create rin
> ```
> 这就是最终的命令


打开仓库页面：https://github.com/OXeu/Rin
## Fork 
点击 Fork 按钮 fork 出一个新仓库
![1000000657](https://github.com/OXeu/Rin/assets/36541432/df3607ca-a8a9-49b8-92ce-6b348afeb13f)


## 前端
登录 [Cloudflare](https://dash.cloudflare.com) 控制台，进入 `Workers 和 Pages` 页面，点击`创建应用程序`，选择 Pages

![1000000658](https://github.com/OXeu/Rin/assets/36541432/35d4f9e3-3af3-4ec8-8060-2a352f4d51ae)

点击连接到 Git 连接自己的 Github 账号并选择 Fork 的存储库

![1000000666](https://github.com/OXeu/Rin/assets/36541432/e3b6da75-1a5f-46ec-9820-636cc5238023)


点击 `开始设置` 进入配置页面：

构建设置按照填入以下内容：
```
框架预设：无
构建命令：bun b
构建输出目录：client/dist
路径：<留空>
```
![1000000659](https://github.com/OXeu/Rin/assets/36541432/98fb3021-932b-4bfa-8118-3378f98ff628)


环境变量复制以下内容，根据自身情况修改变量值：
>[!IMPORTANT]
最后两行环境变量 `SKIP_DEPENDENCY_INSTALL` 和 `UNSTABLE_PRE_BUILD` 为配置 Cloudflare 使用 Bun 进行构建的参数，不要修改
```ini
NAME=Xeu # 昵称，显示在左上角
DESCRIPTION=杂食动物 # 个人描述，显示在左上角昵称下方
AVATAR=https://avatars.githubusercontent.com/u/36541432 # 头像地址，显示在左上角
API_URL=https://rin.xeu.life # 服务端域名，可以先留空后面再改
SKIP_DEPENDENCY_INSTALL=true
UNSTABLE_PRE_BUILD=asdf install bun latest && asdf global bun latest && bun i
```
![1000000660](https://github.com/OXeu/Rin/assets/36541432/0fe9276f-e16f-4b8a-87c5-14de582c9a3a)


点击`保存并部署`，等待构建部署，不出意外的话约 30s 后即可部署完成：

![1000000661](https://github.com/OXeu/Rin/assets/36541432/979810b7-3f6f-415b-a8e8-5b08b0da905d)


点击打开即可看见前端页面

![1000000662](https://github.com/OXeu/Rin/assets/36541432/57c61ad6-c324-48e4-a28f-a1708fd7d41a)


前端就全部部署完成啦🎉

后续可以在 Pages 的设置中再次修改环境变量以及配置域名

但是现在页面中什么内容也没有，因为我们还没有开始部署后端

## 后端

后端部署比较繁琐，但整体分为**创建并初始化数据库**和**创建 Worker** 两个步骤，为了不频繁切换环境这里选择将所有流程在命令行中完成，总体而言，需要使用 git,npm & bun 环境。

### 快速部署

#### 获取用户 ID 与 API 令牌
如果你是在自己带 Linux 桌面的环境中操作的，你可以直接使用`npx wrangler login` 登录，如果你是参照指南在 docker 中操作的，你需要参照 https://developers.cloudflare.com/workers/wrangler/ci-cd/ 来登录

ID 随意点击一个自己绑定的域名，进入后在右侧（需要向下滑动一段距离）可以找到`账户ID`

创建 API 令牌：点击右上角`头像` > `我的个人资料` > `API 令牌` > `创建令牌`，模板选择`编辑 Cloudflare Workers`：
![1000000663](https://github.com/OXeu/Rin/assets/36541432/3a34a2ad-b993-47fe-965d-31cca4a8e92a)


创建完成后保存令牌

在命令行中设置 用户 ID 和 令牌环境变量：
```
export CLOUDFLARE_ACCOUNT_ID=<你的用户ID>
export CLOUDFLARE_API_TOKEN=<你的令牌>
```

这里选择创建一个 Node 的容器来完成这些工作：
```shell
docker run -it node:22 /bin/bash

# 以下内容在容器中执行

# 环境变量建议编辑好后再粘贴
export DB_NAME=xue # 你的数据库名称
export FRONTEND_URL=https://xeu.life # 你的前端地址
export S3_FOLDER=images/ # 在存储桶中存放图片的路径
export WORKER_NAME=xue-server # 你的 Worker 名称
export CLOUDFLARE_ACCOUNT_ID=xxx # 上文获取的 Cloudflare 用户 ID
export CLOUDFLARE_API_TOKEN=xxxxxxx # 上文获取的 Cloudflare API 令牌

# 以下是一键脚本
curl -fsSL https://bun.sh/install | bash
source /root/.bashrc
git clone https://github.com/OXeu/Rin.git
cd Rin/
bun i
cd server/
cat << EOF > wrangler.toml
#:schema node_modules/wrangler/config-schema.json
name = "$WORKER_NAME"
main = "src/_worker.ts"
compatibility_date = "2024-05-29"
# compatibility_flags = ["nodejs_compat"]
node_compat = true

[triggers]
crons = ["*/20 * * * *"]

[vars]
FRONTEND_URL = "$FRONTEND_URL"
S3_FOLDER = "$S3_FOLDER"
EOF
bunx wrangler d1 create $DB_NAME | grep -A10000 '[[d1_databases]]' >> wrangler.toml
SQL_PATH=$(bunx drizzle-kit generate | grep -oP 'drizzle/\d+_[\w_]+\.sql')
bunx wrangler d1 execute $DB_NAME --remote --file=$SQL_PATH -y
echo -e "n\ny\n" | bunx wrangler deploy
```
这样服务端就部署好了，但是我们还需要配置 Github OAuth用于登录和 S3 存储用于存储图片


回到 Cloudflare 面板配置后端域名与一些敏感的环境变量

在 `设置` > `触发器` > `自定义域` 处可以自定义后端的域名，默认也有分配一个`workers.dev`的域名

在 `设置` > `变量` > `环境变量` 处编辑变量，点击添加变量，复制粘贴以下内容至变量名处即可自动添加上所有环境变量，之后再根据自己的具体配置修改变量值：
```
GITHUB_CLIENT_ID=YourGithubClientID
GITHUB_CLIENT_SECRET=YourGithubClientSecret
JWT_SECRET=YourJWTSecret
S3_BUCKET=YourBucketName
S3_REGION=YourRegion
S3_ENDPOINT=YourEndpoint
S3_ACCESS_HOST=YourAccessHost
S3_ACCESS_KEY_ID=YourAccessKeyID
S3_SECRET_ACCESS_KEY=YourSecretAccessKey
```

## 接入 Github OAuth

打开 <https://github.com/settings/developers>，选择 `New OAuth App` 创建一个新的 Oauth App，填入自己的应用名称与主页地址(带`http://`或`https://`)，`Authorization callback URL` 填写

```
https://<你的后端地址>/user/github/callback
```

这里附上我的参数 
![Github OAuth 配置](https://github.com/OXeu/Rin/assets/36541432/74ab8d16-93ca-4919-beec-4beb7a2003a6)




随后配置环境变量中 OAuth 部分 

以下是具体的配置，`GITHUB_CLIENT_ID`填写 Github OAuth App 中的`Client ID`,`GITHUB_CLIENT_SECRET`填写在 Github OAuth App 点击 `Generate a new client secret` 后的 `Client secret`，注意每次创建后只展示一次，后续无法查看，如果不慎丢失重新生成一个新的即可

## 创建 R2 桶

理论上支持任意遵循 S3 协议的对象存储服务，这里只介绍接入 Cloudflare R2 的操作

Cloudflare 面板中点击 `R2` > `创建存储桶`，填写名称，选择距离自己近的位置：
![1000000665](https://github.com/OXeu/Rin/assets/36541432/17c5ad7b-8a3a-49b2-845a-8d043484aa63)


创建存储桶之后进入存储桶详情页 > `设置`，复制 S3 API 地址，去除末尾的存储桶名称后填入 `S3_ENDPOINT`，如：
```ini
S3_BUCKET=image # 桶名称
S3_REGION=auto # 地区 auto 不用修改
S3_ENDPOINT=https://8879900e5e1219fb745c9f69b086565a.r2.cloudflarestorage.com
```
然后在`公开访问`处绑定一个域名用于访问资源，绑定的域名对应于`S3_ACCESS_HOST`环境变量：
```ini
S3_ACCESS_HOST=https://image.xeu.life
```
然后创建一个 API 令牌用于访问存储桶，可参考 https://developers.cloudflare.com/r2/api/s3/tokens/ ，这里不再赘述，拿到 ID 和 TOKEN 对应于`S3_ACCESS_KEY_ID` 和 `S3_SECRET_ACCESS_KEY` 变量，填入 Workers 的环境变量中

至此后端就已经部署完成了，记得将前端的 API_URL 修改为后端的地址，与此同时，如果你需要 WebHook 通知的话，还可在后端配置环境变量`WEBHOOK_URL`为你的 Webhook 地址，在新增评论时会像目标 URL 发送一条 POST 消息，消息格式为：
```json
{
  "content": "消息内容"
}
```

>[!TIP]
在所有环境变量调试完毕后可点击加密按钮加密环境变量（只保留FRONTEND_URL和S3_FOLDER），这样下次部署时加密的环境变量就不会覆盖/删除了
