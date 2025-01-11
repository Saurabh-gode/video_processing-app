const { spawn } = require("node:child_process");

const makeThumbnail = async (fullPath, thumbnail) => {
    // ffmpeg -i rickroll.mp4 -ss 5 -vframes 1 thumbnail.png

    return new Promise((resolve, reject) => {

        const ffprocess = spawn("ffmpeg", [
            `-i`,
            `${fullPath}`,
            `-ss`,
            `3`,
            `-vframes`,
            `1`,
            `${thumbnail}`,
        ])

        ffprocess.on('exit', (code, signal) => {
            console.log(`ffprocess process exited with code ${code} and signal ${signal}`);
            resolve("thumbnail created.")
        });

        ffprocess.on('error', (err) => {
            reject(err);
        });
    })


}

const getDimensions = async (fullPath) => {
    // ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 video.mp4

    return new Promise((resolve, reject) => {

        const ffprocess = spawn("ffprobe", [
            `-v`,
            `error`,
            `-select_streams`,
            `v:0`,
            `-show_entries`,
            `stream=width,height`,
            `-of`,
            `csv=p=0`,
            `${fullPath}`,
        ])
        let width = 0, height = 0;

        ffprocess.stdout.on("data", (data) => {
            // console.log(data.toString("utf-8"));
            let d = data.toString("utf-8").replaceAll(" ", "").split(",");
            width = d[0];
            height = d[1];
        })

        ffprocess.on('exit', (code, signal) => {
            console.log(`ffprocess process exited with code ${code} and signal ${signal}`);
            resolve({
                width: Number(width),
                height: Number(height)
            })
        });

        ffprocess.on('error', (err) => {
            reject(err);
        });
    })

}

const getExtractedAudio = async (fullPath, targetPath) => {
    // ffmpeg -i rickroll.mp4 -vn -c:a copy audio.aac 

    return new Promise((resolve, reject) => {

        const ffprocess = spawn("ffmpeg", [
            `-i`,
            `${fullPath}`,
            `-vn`,
            `-c:a`,
            `copy`,
            `${targetPath}`,
        ])

        ffprocess.on('exit', (code, signal) => {
            console.log(`ffprocess process exited with code ${code} and signal ${signal}`);
            resolve("Audio extracted.")
        });

        ffprocess.on('error', (err) => {
            reject(err);
        });
    })


}

const resizeVideo = async (originalVideoPath, targetVideoPath, width, height) => {
    // ffmpeg -i rickroll.mp4 -vf scale=320:240 -c:a copy rickroll-320x240.mp4 

    return new Promise((resolve, reject) => {

        const ffprocess = spawn("ffmpeg", [
            `-i`,
            `${originalVideoPath}`,
            `-vf`,
            `scale=${width}:${height}`,
            `-c:a`,
            `copy`,
            `-threads`,
            `2`,
            `${targetVideoPath}`,
        ])

        ffprocess.on('exit', (code, signal) => {
            console.log(`ffprocess process exited with code ${code} and signal ${signal}`);
            resolve("video resized.")
        });

        ffprocess.on('error', (err) => {
            console.log('error resize', err)
            reject(err);
        });
    })


}


module.exports = {
    makeThumbnail,
    getDimensions,
    getExtractedAudio,
    resizeVideo
};