import "./styles/index.css";
import "mdui/dist/css/mdui.min.css";
import mdui from "mdui";
import T from "./utils/index";
import Chat from "./js/chat.js";
import DrawBoard from "./js/drawBoard.js";
import randomString from "random-string";

const userInfo = {};
window.onload = () => {
  //其它事件
  let showPanel = false;
  //画布对象和上下文
  let canvas = T.getEle("#canvas");
  let ctx = canvas.getContext("2d");
  userInfo.username = `游客${randomString({
    length: 8,
    numeric: false,
    letters: true,
    special: false,
  })}`;
  //协作设置
  let msgBox = T.getEle(".msgBox");
  let msgInput = T.getEle(".msgTxt");
  let video = document.getElementById("VIDEO");
  let inst_RTC = new mdui.Dialog(T.getEle("#example-5"), {
    modal: true,
    closeOnEsc: false,
  });
  let isVideoOn = false;

  //实例化聊天对象
  let chat = new Chat({
    receive: [
      {
        socketName: "getChatData",
        callback: (res) => {
          if (res) {
            try {
              res = JSON.parse(res);
              if (/data:image/.test(res.msg)) {
                msgBox.innerHTML += Chat.TPL().genChatImgTpl(
                  res.username,
                  res.msg
                );
              } else {
                msgBox.innerHTML += Chat.TPL().genChatTxtTpl(
                  res.username,
                  res.msg
                );
                if (userInfo.username !== res.username) {
                  mdui.snackbar({
                    message: `${res.username}发来消息:${res.msg}`,
                    position: "right-top",
                  });
                }
              }
            } catch (e) {
              mdui.snackbar({
                message: "数据格式有误",
                position: "top",
              });
            }
          }
        },
      },
      {
        socketName: "updateUserList",
        callback: (res) => {
          try {
            res = JSON.parse(res);
            T.getEle(".wrapUserList").innerHTML = "";
            res.forEach((item) => {
              T.getEle(".wrapUserList").innerHTML += `
							<div class="mdui-chip">
								<span class="mdui-chip-icon ${
                  item.data === userInfo.username
                    ? "mdui-color-yellow"
                    : "mdui-color-black"
                }">${item.data.substring(0, 1)}</span>
								<span class="mdui-chip-title mdui-text-truncate" style="max-width: 95px;">${
                  item.data
                }</span>
							</div>
							`;
            });
          } catch (error) {
            mdui.snackbar({
              message: "数据格式有误",
              position: "top",
            });
          }
        },
      },
      {
        socketName: "resetBeginPath",
        callback: (res) => {
          try {
            res = JSON.parse(res);
            if (res.status && res.username != userInfo.username) {
              ctx.beginPath();
            }
          } catch (error) {
            console.log(error);
          }
        },
      },
    ],
  });
  //实例化画板
  const db = new DrawBoard(
    {
      canvas,
      ctx,
      penceilWeight,
      winW: T.getTargetWH()[0],
      winH: T.getTargetWH()[1],
    },
    chat.getSocket()
  );
  //配置重置
  chat.getSocket().on("resetConfig", (res) => {
    try {
      res = JSON.parse(res);
      console.log(res);
      if (res.username != userInfo.username) {
        res.config.travel != 0 ? db.travel(res.config.travel) : false;
        res.config.clearCanvas ? db.clearCanvas() : false;
        res.config.penceilWeight
          ? db.updateCtxStyle({ penceilWeight: res.config.penceilWeight })
          : false;
        res.config.penceilColor
          ? db.updateCtxStyle({ penceilColor: res.config.penceilColor })
          : false;
        res.config.canvasColor
          ? db.updateCtxStyle({ canvasColor: res.config.canvasColor })
          : false;
      }
    } catch (error) {
      console.log(error);
    }
  });
  chat.getSocket().on("setScreenshot", (res) => {
    try {
      console.log(res);
      let data = res.shot.buffer.split(",");
      let imageData = new ImageData(
        new Uint8ClampedArray(data),
        res.shot.width,
        res.shot.height
      );

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.log(error);
    }
  });
  //封装发送配置信息

  //相关事件监听//需要同步事件
  T.getEle("#backward").onclick = () => {
    db.travel(-1);
    chat.sendData(
      "syncConfig",
      JSON.stringify({ username: userInfo.username, config: { travel: -1 } })
    );
  };
  T.getEle("#forward").onclick = () => {
    db.travel(1);
    chat.sendData(
      "syncConfig",
      JSON.stringify({ username: userInfo.username, config: { travel: 1 } })
    );
  };

  T.getEle("#clearAll").onclick = () => {
    db.clearCanvas();
    chat.sendData(
      "syncConfig",
      JSON.stringify({
        username: userInfo.username,
        config: { clearCanvas: true },
      })
    );
  };
  T.getEle("#penceilWeight").onchange = function () {
    this.value = this.value > 120 ? 120 : this.value;
    this.value = this.value < 1 ? 1 : this.value;
    db.updateCtxStyle({ penceilWeight: this.value });
    chat.sendData(
      "syncConfig",
      JSON.stringify({
        username: userInfo.username,
        config: { penceilWeight: this.value },
      })
    );
  };
  T.getEle("#penceilColor").onchange = function () {
    db.updateCtxStyle({ penceilColor: this.value });
    chat.sendData(
      "syncConfig",
      JSON.stringify({
        username: userInfo.username,
        config: { penceilColor: this.value },
      })
    );
  };
  T.getEle("#canvasColor").onchange = function () {
    db.updateCtxStyle({ canvasColor: this.value });
    chat.sendData(
      "syncConfig",
      JSON.stringify({
        username: userInfo.username,
        config: { canvasColor: this.value },
      })
    );
  };
  let scaleNum = T.getEle("#scaleNum");
  T.getEle("#larger").onclick = () => {
    db.scaleHandler(scaleNum, true);
  };
  T.getEle("#smaller").onclick = () => {
    db.scaleHandler(scaleNum, false);
  };

  T.getEle("#tool-rtc").onclick = () => {
    if (isVideoOn) {
      return;
    }
    isVideoOn = true;
    const constraints = {
      audio: true,
      video: true,
    };
    T.getEle("#stopVideo").onclick = null;
    T.getEle("#pauseVideo").onclick = null;
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(function (stream) {
        inst_RTC.open();
        /* 使用这个stream stream */
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
        T.getEle("#pauseVideo").onclick = () => {
          let data = T.computeFrame(ctx, canvas, video);
          console.log(data.data.buffer);
          let buffer = "";
          buffer += data.data[0];
          data.data.forEach((b, idx) => {
            if (idx >= 1) buffer += "," + b;
          });
          chat.sendData("screenshot", {
            username: userInfo.username,
            shot: { width: data.width, height: data.height, buffer },
          });
        };
        T.getEle("#stopVideo").onclick = () => {
          isVideoOn = false;
          stream.getTracks().forEach(function (track) {
            track.stop();
          });
        };
      })
      .catch(function (err) {
        /* 处理error */
        console.log(err);
      });
  };

  T.getEle("#selectChatImgTrigger").onclick = () => {
    T.getEle("#chatImgSelect").click();
  };
  T.getEle("#chatImgSelect").onchange = function () {
    let that = this;
    T.getEle("#selectChatImgTrigger").style.cssText = "border:solid 1px red;";
    let img = document.createElement("img");
    img.src = URL.createObjectURL(this.files[0]);
    img.onload = () => {
      var imgBase64 = T.genImgBase64(img);
      chat.sendData(
        "chatData",
        JSON.stringify({
          username: userInfo.username,
          msg: imgBase64,
        }),
        (res) => {
          if (res) {
            that.files = null;
          }
        }
      );
    };
  };

  //发送聊天消息
  T.getEle(".sendBtn").onclick = function () {
    if (msgInput.value.replace(/ /gim, "") == "") {
      mdui.snackbar({
        message: "不要发送空消息",
        position: "top",
      });
      return;
    }
    chat.sendData(
      "chatData",
      JSON.stringify({
        username: userInfo.username,
        msg: msgInput.value,
      }),
      (res) => {
        if (res) {
          msgInput.value = "";
        } else {
          alert("发送消息中断");
        }
      }
    );
  };
  //添加用户
  let initUserData = (value) => {
    // mdui.snackbar("欢迎" + value, {
    //   buttonColor: "lightpink",
    //   position: "top",
    // });
    chat.sendData("addUser", userInfo.username);
    sessionStorage.setItem("drawusername", userInfo.username);
    T.getEle(".userNameTag").innerHTML = userInfo.username;
  };
  mdui.prompt(
    "输入用户名，不输入则随机命名",
    function (value) {
      userInfo.username = value || userInfo.username;
      initUserData(userInfo.username);
    },
    function (value) {
      //onCancel
      initUserData(userInfo.username);
    },
    {
      cancelText: "随机吧",
      confirmText: "填好了",
      modal: true,
      closeOnEsc: false,
      confirmOnEnter: true,
      history: false,
      modal: true,
    }
  );

  //弹出聊天界面事件绑定
  var tab = new mdui.Tab("#example4-tab");
  document
    .getElementById("example-4")
    .addEventListener("open.mdui.dialog", function () {
      tab.handleUpdate();
    });
};
