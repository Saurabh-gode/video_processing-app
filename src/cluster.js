const cluster = require("node:cluster");
const os = require("node:os");
const JobQueue = require("./lib/JobQueue");


if (cluster.isPrimary) {
    const coresCount = os.availableParallelism();

    const jobs = new JobQueue();

    console.log('coresCount', coresCount);

    for (let index = 0; index < coresCount; index++) {
        cluster.fork();
    }

    cluster.on("message", (worker, message) => {
        if (message.messageType === "new-resize") {
            const { videoId, width, height } = message.data;

            jobs.enqueue({
                type: "resize",
                videoId,
                width,
                height
            })

        }
    });

    cluster.on("exit", (worker, code, signal)=>{
        console.log(`worker ${worker.process.pid} died. ${signal} | ${code} Restarting.`);

        // restart.
        cluster.fork()
    })

} else {
    require("./index");
}