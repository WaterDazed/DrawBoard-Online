import { Socket } from "socket.io-client";

export type SocketIOClientType = typeof Socket;
export interface IDrawboradConf {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    winW: number;
    winH: number;
    penceilWeight?: number;
    penceilColor?: string;
    canvasColor?: string;
    canvasPadding?: number;
}
export type ICtxStyle = Partial<IDrawboradConf>;
export type DrawEvent = MouseEvent & TouchEvent;
class DrawBoard {
    //画布对象和上下文
    socket: SocketIOClientType;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    winW: number;
    winH: number;
    canvasW: number;
    canvasH: number;
    canvasPadding: number;
    //绘制堆栈
    //drawHistoryStack: Array<any> = [];
    scaleList: Array<number> = [1, 1]; //第一个参数用于调整画布的绘制缩放布宽为0.1，第二个参数为缩放倍率dpr
    //时间旅行步数
    //timeTravelStep: number = -1;

    //时延控制
    recvBuffer: Array<any> = [];
    delayTime: number = 0;
    //卡顿控制
    lagStartFrame: number = 0;
    lagFrame: number = 0;
    lagStartCount: number = 0;
    lagCount: number = 0;
    //绘制
    remoteLastX: number = 0;
    remoteLastY: number = 0;
    lastX: number = 0;
    lastY: number = 0;


    drawLayerLeft: number = 0; //画布横坐标
    drawLayerTop: number = 0; //画布纵坐标
    cansLimitLt: number = 0; //画布左边界
    cansLimitRt: number = 0; //画布右边界
    cansLimitTp: number = 0; //画布上边界
    cansLimitBt: number = 0; //画布下边界

    static Lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }
    //构造函数
    constructor(obj: IDrawboradConf, socket: SocketIOClientType) {
        //画布对象和上下文
        this.socket = socket;
        this.canvas = obj.canvas;
        this.ctx = obj.ctx;
        this.winW = obj.winW; //屏幕宽
        this.winH = obj.winH; //屏幕高
        this.canvasW = this.winW * 0.985; //画布高
        this.canvasH = this.winH * 0.77; //画布高
        this.canvas.width = this.canvasW;
        this.canvas.height = this.canvasH;
        this.canvasPadding =/* obj.canvasPadding ?? */5; //画布padding，用于界定边框线
        //画笔 画布相关数据
        this.ctx.lineWidth =/* obj.penceilWeight ?? */3;
        this.ctx.strokeStyle =/* obj.penceilColor ?? */"#000000";
        this.canvas.style.backgroundColor =/* obj.canvasColor ?? */"none";
        this.updateParam();
        this.init();
        this.ctx.beginPath();

        //alert(this.delayTime);
        this.socket.on("getDrawData", (res: string) => {
            let data = JSON.parse(res);
            if (data.username != sessionStorage.getItem("drawusername")) {//如果发送端不是自己
                let timeStamp = Date.parse(new Date().toString());
                data.timeStamp = timeStamp;
                this.recvBuffer.push(data);
            }               
        });
        setInterval(() => {//定时检查recvBuffer
            let timeNow = Date.parse(new Date().toString());//ms
            if (this.recvBuffer.length > 0) {
                let data = this.recvBuffer[0];
                if (timeNow - data.timeStamp >= this.delayTime) {
                    if (this.lagStartFrame == 0 || this.lagFrame == 0 ||this.lagStartCount < this.lagStartFrame) {
                        let x = data.axis[0], y = data.axis[1];
                        //if (data.touchFirst)
                        //    this.ctx.beginPath();
                        //this.ctx.lineTo(data.axis[0], data.axis[1]);
                        //this.ctx.stroke();
                        if (data.touchFirst) {
                            this.DrawCircle(x, y, "#ff0000");
                            this.remoteLastX = x;
                            this.remoteLastY = y;
                        }
                        else {
                            for (let t = 0.00; t < 1.00; t += 0.01) {
                                let lerpX = DrawBoard.Lerp(this.remoteLastX, x, t);
                                let lerpY = DrawBoard.Lerp(this.remoteLastY, y, t);
                                this.DrawCircle(lerpX, lerpY,"#ff0000");
                            }
                            this.remoteLastX = x;
                            this.remoteLastY = y;
                        }
                        //this.pushStack();
                        this.recvBuffer.shift();
                        this.lagStartCount++;
                    } else if (this.lagCount < this.lagFrame) {
                        this.lagCount++;
                    } else {
                        this.lagStartCount = 0;
                        this.lagCount = 0;
                    }
                }
            }
        }, 16);//60fps
    }
    DrawCircle(x: number, y: number, color: string) {
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    //更新参数 画布边界值和画布横纵坐标
    updateParam() {
        //预设参数2
        this.drawLayerLeft = this.canvas.offsetLeft; //画布横坐标
        this.drawLayerTop = this.canvas.offsetTop; //画布纵坐标
        this.cansLimitLt = this.canvasPadding; //左边界
        this.cansLimitRt = this.canvasW - this.canvasPadding; //右边界
        this.cansLimitTp = this.canvasPadding; //上边界
        this.cansLimitBt = this.canvasH - this.canvasPadding; //下边界
    }
    //更新上下文样式参数
    updateCtxStyle(obj: ICtxStyle) {
        console.log(obj);
        this.ctx.lineWidth = obj.penceilWeight || this.ctx.lineWidth;
        this.ctx.strokeStyle = obj.penceilColor || this.ctx.strokeStyle;
        this.canvas.style.backgroundColor =
            obj.canvasColor || this.canvas.style.backgroundColor;
    }

    /**
     * @desc 返回鼠标在画布上的横纵坐标
     * @param Object event 事件对象(可选)
     * @return Array [x,y]
     */
    mouseXY(event: DrawEvent) {
        event = event || window.event;
        let x =
            event.clientX + window.scrollX ||
            event.pageX + window.scrollX ||
            event.touches[0].clientX + window.scrollX ||
            event.touches[0].pageX + window.scrollX;
        let y =
            event.clientY + window.scrollY ||
            event.pageY + window.scrollY ||
            event.touches[0].clientY + window.scrollY ||
            event.touches[0].pageY + window.scrollY;

        return [
            (x - this.drawLayerLeft) / this.scaleList[1],
            (y - this.drawLayerTop) / this.scaleList[1],
        ];
    }

    //绘制堆栈进入操作
    //由于栈溢出崩溃问题，删去撤销和重做功能
    pushStack() {
        //this.timeTravelStep++;
        //this.drawHistoryStack.push(this.canvas.toDataURL());
    }

    /**
     * @desc 同步数据方法(通过socket.io传送数据)
     * @param Array axis 坐标数组
     */
    syncData(axis: number[], touchFirst: boolean) {
        let timeStamp = 0;
        let data = JSON.stringify({
            username: sessionStorage.getItem("drawusername"),
            axis,
            timeStamp,
            touchFirst
        });
        this.socket.emit("sendDrawData", data);
    }
    /**
     * @desc 绘制事件绑定监听
     * @param Boolean isunbind 解除所有是与绘制相关的绑定事件
     */
    drawEvent(isUnbind: boolean = false) {
        let eventStart = "void",
            eventEnd = "void",
            eventMove = "void";
        if ("ontouchstart" in window) {
            eventStart = "ontouchstart";
            eventEnd = "ontouchend";
            eventMove = "ontouchmove";
        } else {
            eventStart = "onmousedown";
            eventEnd = "onmouseup";
            eventMove = "onmousemove";
        }
        if (isUnbind) {
            this.canvas[eventStart] = null;
            this.canvas[eventMove] = null;
            this.canvas[eventEnd] = null;
            return void 0;
        }
        //监听开始触摸（点击）屏幕事件
        this.canvas[eventStart] = (e: DrawEvent) => {
            //this.ctx.beginPath();
            let touchFirst = true;
            //监听开始滑动绘制事件
            this.canvas[eventMove] = (e: DrawEvent) => {
                let mouseAxis = this.mouseXY(e);
                if (
                    mouseAxis[0] < this.cansLimitLt ||
                    mouseAxis[0] > this.cansLimitRt ||
                    mouseAxis[1] < this.cansLimitTp ||
                    mouseAxis[1] > this.cansLimitBt
                ) {
                    this.canvas[eventMove] = null;
                } else {
                    //this.ctx.lineTo(mouseAxis[0], mouseAxis[1]);
                    let x = mouseAxis[0], y = mouseAxis[1];
                    if (touchFirst) {
                        this.DrawCircle(x, y,"#000000");
                        this.lastX = x;
                        this.lastY = y;
                    }
                    else {
                        for (let t = 0.00; t < 1.00; t += 0.01) {
                            let lerpX = DrawBoard.Lerp(this.lastX, x, t);
                            let lerpY = DrawBoard.Lerp(this.lastY, y, t);
                            this.DrawCircle(lerpX, lerpY,"#000000");
                        }
                        this.lastX = x;
                        this.lastY = y;
                    }
                    this.syncData(mouseAxis, touchFirst);
                    if (touchFirst) 
                        touchFirst = false;
                 
                }
                //this.ctx.stroke();
                //this.pushStack();
            };
        };
        //监听触摸（点击）屏幕事件结束，置空滑动事件和将当前画布信息进栈
        this.canvas[eventEnd] = (e: DrawEvent) => {
            this.canvas[eventMove] = null;
            this.socket.emit(
                "canSetBeginPath",
                JSON.stringify({ username: sessionStorage.getItem("drawusername") })
            );
        };
    }
    //画布历史穿梭（前进和后退）
    travel(dir: number) {
        //if (this.drawHistoryStack.length > 0) {
        //    if (dir < 0) {
        //        if (--this.timeTravelStep < -1) {
        //            this.timeTravelStep = -1;
        //            return;
        //        }
        //    } else if (dir > 0) {
        //        if (++this.timeTravelStep >= this.drawHistoryStack.length) {
        //            this.timeTravelStep = this.drawHistoryStack.length - 1;
        //            return;
        //        }
        //    }
        //    let cmDrawImg = () => {
        //        let img = new Image();
        //        img.src = this.drawHistoryStack[this.timeTravelStep];
        //        img.onload = () => this.ctx.drawImage(img, 0, 0);
        //    };
        //    this.ctx.clearRect(0, 0, this.canvasW, this.canvasH);
        //    cmDrawImg();
        //}
    }
    //缩放画布
    scaleHandler(dprBox: HTMLInputElement, isLarge: boolean) {
        if (isLarge) {
            dprBox.value = (+dprBox.value + 0.1).toFixed(1);
            this.scaleList[1] = +dprBox.value;
            if (this.scaleList[1] > 5) {
                this.scaleList[1] = 5;
                dprBox.value = "5";
                return;
            }
        } else {
            dprBox.value = (+dprBox.value - 0.1).toFixed(1);
            this.scaleList[1] = +dprBox.value;
            if (this.scaleList[1] < 0.1) {
                this.scaleList[1] = 0.1;
                dprBox.value = "0.1";
                return;
            }
        }
        this.canvas.style.width = this.canvasW * this.scaleList[1] + "px";
        this.canvas.style.height = this.canvasH * this.scaleList[1] + "px";
        this.updateParam();
    }
    //清除画布
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvasW, this.canvasH);
        //this.timeTravelStep = -1;
        //this.drawHistoryStack = [];
    }
    //初始化
    init() {
        this.drawEvent();
        window.onresize = () => {
            this.drawEvent(true);
            this.updateParam();
            this.drawEvent();
            //this.travel(0);
        };
    }
}

export default DrawBoard;
export { DrawBoard };
