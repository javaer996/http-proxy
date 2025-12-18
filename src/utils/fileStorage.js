const fs = require('fs');
const path = require('path');

class FileStorage {
  read(filePath) {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(content);
  }

  write(filePath, data) {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      absolutePath,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  exists(filePath) {
    return fs.existsSync(path.resolve(filePath));
  }
}

module.exports = new FileStorage();
