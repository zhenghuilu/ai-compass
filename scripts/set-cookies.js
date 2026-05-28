const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SOURCES = ['36kr'];
const COOKIE_DIR = path.join(__dirname, '../cookies');

function getSourceFromArgs() {
  const idx = process.argv.indexOf('--source');
  if (idx >= 0 && idx + 1 < process.argv.length) {
    const source = process.argv[idx + 1];
    if (SOURCES.includes(source)) return source;
    console.error(`无效数据源: ${source}，可选: ${SOURCES.join(', ')}`);
    process.exit(1);
  }
  return '36kr';
}

function promptUser(source) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n🔑 设置 ${source} Cookie`);
  console.log('─'.repeat(50));
  console.log('操作步骤：');
  console.log('  1. 用 Chrome 打开 https://36kr.com/feed');
  console.log('  2. 完成滑块验证');
  console.log('  3. 按 F12 打开 DevTools → Network');
  console.log('  4. 刷新页面，点击第一个请求');
  console.log('  5. 在 Request Headers 中找到 Cookie 字段');
  console.log('  6. 右键 → Copy value');
  console.log('  7. 粘贴到下方并按回车');
  console.log('─'.repeat(50));

  rl.question('\nCookie > ', (cookie) => {
    cookie = cookie.trim();
    if (!cookie) {
      console.log('❌ Cookie 不能为空');
      rl.close();
      return;
    }

    const filePath = path.join(COOKIE_DIR, `${source}.txt`);
    if (!fs.existsSync(COOKIE_DIR)) {
      fs.mkdirSync(COOKIE_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, cookie, 'utf-8');
    console.log(`✅ Cookie 已保存到 ${filePath}`);
    console.log(`📝 共 ${cookie.split(';').length} 个键值对`);

    // 测试 cookie 是否有效
    console.log('\n🔍 验证 Cookie 有效性...');
    const axios = require('axios');
    axios
      .get('https://36kr.com/feed', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Cookie: cookie,
        },
        timeout: 10000,
      })
      .then((res) => {
        if (res.data.includes('<rss') || res.data.includes('<item>')) {
          console.log('✅ Cookie 有效！RSS 可正常访问');
        } else if (res.data.includes('captcha') || res.data.includes('TTGCaptcha')) {
          console.log('❌ Cookie 未通过验证，仍返回验证码页面');
          console.log('   请重新获取最新的 Cookie');
        } else {
          console.log('⚠️  响应内容异常，请检查 Cookie 是否过期');
        }
        rl.close();
      })
      .catch((err) => {
        console.log(`❌ 请求失败: ${err.message}`);
        rl.close();
      });
  });
}

const source = getSourceFromArgs();
promptUser(source);
