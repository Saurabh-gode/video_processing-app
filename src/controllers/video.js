const path = require("path");
const crypto = require("crypto");
const cluster = require("node:cluster");
const fs = require("fs/promises");
const { pipeline } = require("node:stream/promises");
const util = require("../lib/util");
const DB = require("../DB");
const FF = require("../lib/FF");

const JobQueue = require("../lib/JobQueue");

let jobs;

if (cluster.isPrimary) {
    jobs = new JobQueue();
}


const getVideos = async (req, res, handlerErr) => {
    try {
        DB.update();

        const videos = DB.videos.filter((vid) => {
            return vid.userId === req.userId
        });

        if (!videos) {
            return handlerErr({ status: 400, message: "Please specify name" })
        }

        return res.status(200).json(videos)

    } catch (e) {
        return handlerErr({ status: 400, message: "something went wrong" })
    }
}

const getVideoAssets = async (req, res, handlerErr) => {
    try {
        const videoId = req.params.get("videoId");
        const type = req.params.get("type");

        DB.update();

        const video = DB.videos.find((video) => video.videoId === videoId);

        if (!video) {
            return handlerErr({
                status: 404,
                message: "video not found!"
            })
        }

        let file, mimetype, filename;

        switch (type) {
            case "thumbnail": {
                file = await fs.open(`./storage/${videoId}/thumbnail.jpg`, "r");
                mimetype = "image/jpeg";
                break;
            }
            case "original": {
                file = await fs.open(`./storage/${videoId}/original.${video.extension}`, "r");
                mimetype = "video/mp4";
                filename = `${video.fileName}.${video.extension}`;
                break;
            }
            case "audio": {
                file = await fs.open(`./storage/${videoId}/audio.aac`, "r");
                mimetype = "audio.aac";
                filename = `${video.fileName}-audio.aac`;
                break;
            }
            case "resize": {
                const dimensions = req.params.get("dimensions");
                file = await fs.open(`./storage/${videoId}/${dimensions}.${video.extension}`, "r");
                mimetype = "video/mp4";
                filename = `${video.fileName}-${dimensions}.${video.extension}`;
                break;
            }
        }

        const stat = await file.stat();

        const fileStream = file.createReadStream();

        res.setHeader("content-type", mimetype);
        res.setHeader("content-length", stat.size);

        if (type !== "thumbnail") res.setHeader("content-disposition", `attachment; filename=${filename}`)

        res.status(200);

        await pipeline(fileStream, res);

        file.close();

    } catch (e) {
        console.log(e)
        return handlerErr({ status: 400, message: "something went wrong" })
    }
}

const uploadVideo = async (req, res, handlerErr) => {

    const reqfileName = req.headers.filename;
    const extension = path.extname(reqfileName).substring(1).toLowerCase();
    const fileName = path.parse(reqfileName).name;
    const theVideoId = crypto.randomBytes(4).toString("hex");
    const dirPath = `./storage/${theVideoId}`;
    const SUPPORTED_FORMATS = ["mov", "mp4"];


    if (SUPPORTED_FORMATS.indexOf(extension) == -1) {
        return handlerErr({ status: 400, message: "Only mp4, mov format supported." })
    }

    try {

        await fs.mkdir(dirPath, { recursive: true });

        const filePath = `${dirPath}/original.${extension}`;

        // open file
        const file = await fs.open(filePath, "w");

        // write stream on open file.
        const fileStream = await file.createWriteStream();

        const thumbnailPath = `${dirPath}/thumbnail.jpg`;
        const fullPath = path.join(__dirname, "../../");


        // piping req file stream to openfile.
        // req.pipe(fileStream);

        // we use pipeline for better defaulr error handling etc. 
        await pipeline(req, fileStream)

        // make thumbnail for the video file.
        await FF.makeThumbnail(`${fullPath}/${filePath}`, `${fullPath}/${thumbnailPath}`);

        const dimensions = await FF.getDimensions(`${fullPath}/${filePath}`);

        console.log(dimensions);

        DB.update();
        DB.videos.unshift({
            id: DB.videos.length,
            videoId: theVideoId,
            fileName,
            extension,
            dimensions,
            userId: req.userId,
            extractedAudio: false,
            resizes: {},
        });

        DB.save()
        // req.on("data")


        return res.json({ status: "success", message: "File uploaded successfully!" })

    } catch (e) {
        console.log(e)
        util.deleteFolder(dirPath);
        if (e.code !== "ECONNRESET") return handlerErr({ status: 400, message: "something went wrong" })
    }
}

const extractAudio = async (req, res, handlerErr) => {
    const videoId = req.params.get("videoId");

    DB.update();
    const video = DB.videos.find((video) => video.videoId === videoId);

    if (video.extractedAudio) {
        return handlerErr({ status: 400, message: "Audio is already extracted." })
    }

    const dirPath = `./storage/${videoId}`;
    const fullPath = path.join(__dirname, "../../");
    const filePath = `${dirPath}/original.${video.extension}`;
    const targetAudioPath = `${dirPath}/audio.aac`;

    try {

        await FF.getExtractedAudio(`${fullPath}/${filePath}`, targetAudioPath);

        video.extractedAudio = true;
        DB.save();

        res.status(200).json({ status: "success", message: "Audio was extracted successfully." })


    } catch (error) {
        console.log(error);
        util.deleteFolder(targetAudioPath);
        if (error.code !== "ECONNRESET") return handlerErr({ status: 400, message: "something went wrong" })
    }
}

const resizeVideo = async (req, res, handlerErr) => {
    const videoId = req.body.videoId;
    const width = Number(req.body.width);
    const height = Number(req.body.height);

    DB.update();
    const video = DB.videos.find((video) => video.videoId === videoId);
    video.resizes[`${width}x${height}`] = { processing: true };
    DB.save();

    if (cluster.isPrimary && jobs) {
        jobs.enqueue({
            type: "resize",
            videoId,
            width,
            height
        })
    } else {
        process.send({
            messageType: "new-resize",
            data: { videoId, width, height }
        })
    }

    res.status(200).json({
        status: "success",
        message: "The Video is now being processed!"
    })

}

module.exports = {
    getVideos,
    uploadVideo,
    getVideoAssets,
    extractAudio,
    resizeVideo
}