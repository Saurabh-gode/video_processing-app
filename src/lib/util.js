const fs = require("fs/promises");
const util = {};

util.deleteFile = async (path) => {
    try {
        await fs.unlink(path)
    } catch (error) {
        console.log(error);
    }
}


util.deleteFolder = async (path) => {
    try {
        await fs.rm(path, { recursive: true });
    } catch (error) {
        console.log(error);
    }
};

module.exports = util;