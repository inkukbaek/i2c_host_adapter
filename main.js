import {MCP2221} from './mcp2221a_web.js'
import {AARDVARK} from './aardvark_web.js'
let i2c_host_adapter;
let i2c_host_adapter_name;
let gp_status;

// ****************************************
// I2C Event Listener
// ****************************************
document.getElementById('connect-aardvark').addEventListener('click', async () => {
    // const result = await navigator.usb.getDevices()
    // console.log(result)
    i2c_host_adapter = new AARDVARK();
    const init_response = await i2c_host_adapter.init();
    i2c_host_adapter_name = i2c_host_adapter.device.productName;
    document.getElementById("connected-adapter").value = `${i2c_host_adapter_name} is connected`

    logMessage(init_response.message)
});

document.getElementById('connect-mcp2221a').addEventListener('click', async () => {
    i2c_host_adapter = new MCP2221();
    const init_response = await i2c_host_adapter.init();
    console.log(i2c_host_adapter.device)
    i2c_host_adapter_name = i2c_host_adapter.device.productName
    document.getElementById("connected-adapter").value = `${i2c_host_adapter_name} is connected`
    logMessage(init_response.message)
    await i2c_host_adapter.init_state();
    gp_status = await i2c_host_adapter.gpioGetPins();
    // console.log(gp_status);
    updateGPIOStates(gp_status);
});

document.getElementById('usb-write-command').addEventListener('click', async () => {
    if (!i2c_host_adapter_name.toLowerCase().includes('Aard'.toLowerCase())) {
        logMessage('Only AARDVARK supports USB function')
        return {message:'Only AARDVARK supports USB function', status: false}
    }
    const interfaceNumber = i2c_host_adapter.interfaceNumber;
    const endpointOut = i2c_host_adapter.endpointOut;
    const usb_command_string = document.getElementById('usb-command').value
    const usb_command = hexStringToArray(usb_command_string);
    await i2c_host_adapter.device.claimInterface(interfaceNumber);
    await i2c_host_adapter.device.transferOut(endpointOut, new Uint8Array(usb_command))
    await i2c_host_adapter.device.releaseInterface(interfaceNumber)
    logMessage( `${i2c_host_adapter_name} - USB WRITE: ${usb_command_string}`);
});

document.getElementById('usb-read-command').addEventListener('click', async () => {
    if (!i2c_host_adapter_name.toLowerCase().includes('Aard'.toLowerCase())) {
        logMessage('Only AARDVARK supports USB function')
        return {message:'Only AARDVARK supports USB function', status: false}
    }
    const interfaceNumber = i2c_host_adapter.interfaceNumber
    const endpointIn = i2c_host_adapter.endpointIn
    try {
        await i2c_host_adapter.device.claimInterface(interfaceNumber);
    }
    catch (error) {
        console.error("Error during claimInterface:", error);
        return
    }

    const read_data = await i2c_host_adapter.device.transferIn(endpointIn, 32); // 1번 엔드포인트에서 32바이트 읽기
    await i2c_host_adapter.device.releaseInterface(interfaceNumber);
    const read_data_arr = new Uint8Array(read_data.data.buffer);
    const log_msg = Array.from(read_data_arr, byte => `0x${byte.toString(16).toUpperCase()}`);
    logMessage( `${i2c_host_adapter_name} - USB READ: ${log_msg}`);
    document.getElementById("usb-read").value = log_msg
});


document.getElementById('reset-mcp2221a').addEventListener('click', async () => {
    try {
        await i2c_host_adapter.reset()
        i2c_host_adapter = new MCP2221();
        const init_response = await i2c_host_adapter.init();
        logMessage(init_response.message)
        await i2c_host_adapter.init_state();
        gp_status = await i2c_host_adapter.gpioGetPins();
    } catch (error) {
        document.getElementById('status').innerText = `Error: ${error.message}`;
    }
});

document.getElementById('i2c-write').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
    const data = document.getElementById('i2c-data').value.split(',').map(value => parseInt(value, 16));
    // Implement I2C write using WebHID API
    console.log(data);
    const i2cWriteData = await i2c_host_adapter.i2cWrite(slaveAddress, registerAddress, data);
    console.log(i2cWriteData);
    const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
    logMessage( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
});

document.getElementById('i2c-read').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
    const length = parseInt(document.getElementById('i2c-length').value);
    // Implement I2C read using WebHID/WebUSB API
    // logMessage( 'i2c-read', hexString(slaveAddress), hexString(registerAddress), hexString(length) );
    const i2cReadData = await i2c_host_adapter.i2cRead(slaveAddress, registerAddress, length);
    if (i2cReadData.success){
        const readLog = Array.from(i2cReadData.data).map(x => hexString(x)).join(', ');
        logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddress), `[${readLog}]`);
    } else {
        logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
    }
});

let i2cScripts = [];
document.getElementById("fileInput").addEventListener("change", function (event) {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    logMessage(`File Name: ${selectedFile.name}`);
    const reader = new FileReader();
    // 파일 내용을 텍스트로 읽기
    reader.readAsText(selectedFile);
    reader.onload = function (e) {
        const content = e.target.result;
        const lines = content.split('\n');
        // 각 줄이 (0x로 시작하는 hex, 0x로 시작하는 hex) 형식인지 확인
        const isValid = lines.every(line => {
            line = line.trim();
            const regex = /^\(0x[0-9A-Fa-f]+,\s*0x[0-9A-Fa-f]+\)$/;
            return line === '' || regex.test(line);
        });

        if (isValid) {
            logMessage(`File format is correct. Script Echo`);
            lines.forEach(line => {
                line = line.trim();
                if (line === '') return;
                logMessage(`${line}`);
            });
            // 기존 스크립트 초기화 후 새 스크립트 추가
            i2cScripts = [];
            lines.forEach(line => {
                line = line.trim();
                // 빈 줄이면 다음 줄로 넘어가기
                if (line === '') return;
                // 괄호와 공백을 제거하고, 쉼표로 나누기
                const [hex1, hex2] = line.replace(/[()]/g, '').split(',').map(s => s.trim());
                // 객체 형태로 저장
                i2cScripts.push({ hex1, hex2 });
            });

        } else {
            logMessage("File format is incorrect. Please upload a valid file.");
            logMessage("Example File Format: (0x01, 0xab)");
        }
    };
    // 같은 파일을 다시 로드할 수 있도록 input 값 초기화
    event.target.value = '';
});

// 버튼 클릭 시 파일 선택 대화 상자를 열기
document.getElementById('i2c-load-script').addEventListener('click', () => {
    document.getElementById("fileInput").click();
});

// document.getElementById("i2c-run-script").addEventListener("click", function() {
document.getElementById('i2c-run-script').addEventListener('click', async () => {

    const slaveAddress = parseInt(document.getElementById('i2c-slave-address-script').value, 16);

    for (const pair of i2cScripts) {
        const registerAddress = parseInt(pair.hex1, 16);
        // const data = parseInt(pair.hex2);
        const data = pair.hex2.split(',').map(value => parseInt(value, 16));
        const i2cWriteData = await i2c_host_adapter.i2cWrite(slaveAddress, registerAddress, data);
        const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
        logMessage( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
    }
});


document.getElementById('i2c-dump').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const firstRegisterAddress = parseInt(document.getElementById('i2c-register-address-first').value, 16);
    const lastRegisterAddress = parseInt(document.getElementById('i2c-register-address-last').value, 16);
    // const length = parseInt(document.getElementById('i2c-length').value);
    const length = 1;
    // Implement I2C read using WebHID API
    for(let regAddr = firstRegisterAddress; regAddr <= lastRegisterAddress; regAddr++) {
        // logMessage( 'i2c-read', hexString(slaveAddress), hexString(regAddr), hexString(length) );
        const i2cReadData = await i2c_host_adapter.i2cRead(slaveAddress, regAddr, length);
        if (i2cReadData.success){
            console.log('i2cRead addr Data', i2cReadData.addr.toString(16), i2cReadData.data);
            const readLog = Array.from(i2cReadData.data).map(x => hexString(x)).join(', ');
            logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(regAddr), `${readLog}`);
        } else {
            logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);

        }

    }
});

document.getElementById('i2c-bit-update').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
    let bitPositions = [];
    let bitValues = [];
    for (let i = 0; i < 8; i++) {
        const bitValue = parseInt(document.getElementById(`bit${i}`).value);

        if ( bitValue === 0 ) {
            bitPositions.push(i);
            bitValues.push(bitValue);
        } else if ( bitValue === 1 ) {
            bitPositions.push(i);
            bitValues.push(bitValue);
        }
    }
    logMessage('bitPositions', bitPositions, 'bitValues', bitValues);
    const i2cWriteData = await i2c_host_adapter.i2cUpdateByte(slaveAddress, registerAddress, bitPositions, bitValues)

    const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
    logMessage( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);

});

document.getElementById('i2c-find-addr').addEventListener('click', async () => {
    const candidates = [];
    const i2c_addr_found = await i2c_host_adapter.i2cSearchSlaveAddress(candidates);
    // logMessage(i2c_addr_found);
    document.getElementById('i2c-slave-address').value = hexString(i2c_addr_found[0])

});

document.getElementById('clear-log').addEventListener('click', async () => {
    clearlogMessage()
});

document.getElementById('extract-log').addEventListener('click', async () => {
    extractlogMessage()
});

function hexStringToArray(hexString) {
    return hexString.split(',').map(value => parseInt(value, 16));
}

const gpioLength = 4
for (let i = 0; i < gpioLength; i++) {
    document.getElementById(`gpio${i}-on`).addEventListener('click', () =>setGPIO(i, 1));
    document.getElementById(`gpio${i}-off`).addEventListener('click', () =>setGPIO(i, 0));
    document.getElementById(`gpio${i}-toggle`).addEventListener('click', () =>toggleGPIO(i));
}


// ****************************************
// Script Run Event Listener
// ****************************************
// document.getElementById('script-run').addEventListener('click', function(e) {
//     const script = document.getElementById('script').value;
//     logMessage(`sending scripttt - ${script}`)
//     worker.postMessage(script)

// });

// worker.onmessage = function(e) {
//     consoleMessage(e.data);
// }

document.getElementById('script-run').addEventListener('click', function(e) {
    const script = document.getElementById('script').value;
    console.log('eval_script');
    eval_script(script).then(result => {
        console.log(result);
    })

    // consoleMessage(result)

});

async function eval_script(script) {
    const result = await evalAsync(script);
    console.log('result', result);
    return result;

}
async function evalAsync(script) {
    console.log('evalAsync', script);
    const async_script = `(async () => { ${script} })()`
    console.log('async_script', async_script)
    return new Promise((resolve, reject) => {
        try {
            (async() => {
                const result = await eval(`(async () => { ${script} })()`);
                console.log('evalAsync result',result)
                resolve(result);
            })();



            // const result = eval(script);
            // if (result instanceof Promise) {
            //     result.then(resolve).catch(reject);
            // } else {
            //     resolve(result);
            // }
        } catch (error) {
            reject(error);
        }

    });
}

// ****************************************
// ETC Event Listener
// ****************************************

const activeTabButtons = document.getElementsByClassName("tab-button active")
    for (let i=0; i < activeTabButtons.length; i++) {
        activeTabButtons[i].addEventListener('click',(event) => {
            const tabName = event.target.dataset.tab
            openTab(event, tabName)
        });
    }

const inactiveTabButtons = document.getElementsByClassName("tab-button")
    for (let i=0; i < inactiveTabButtons.length; i++) {
        inactiveTabButtons[i].addEventListener('click',(event) => {
            const tabName = event.target.dataset.tab
            openTab(event, tabName)
        });
    }

// document.getElementsByClassName("tab-button").addEventListener('click',(event) => {
//     const tabName = event.target.dataset.tabId
//     openTab(event, tabName)
// });
// document.getElementsByClassName("tab-button").addEventListener('click', openTab)


// ****************************************************************************
// function declaration
// ****************************************************************************

function openTab(event, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i=0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active")
    }
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i=0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active")
    }
    event.currentTarget.classList.add("active")
    document.getElementById(tabName).classList.add("active")
}

function updateGPIOStates(gpioStates) {
    // Implement GPIO state update using WebHID API
    for (let i = 0; i < gpioStates.length; i++) {
        const ledElement = document.getElementById(`led-gpio${i}`);
        if (gpioStates[i] === 1) {
            ledElement.style.backgroundColor = 'green';
        } else {
            ledElement.style.backgroundColor = 'red';
        }
    }
    // logMessage('updateGPIOStates finished')

}

function updateGPIOState(pin, gpioState) {
    // Implement GPIO state update using WebHID API
    const ledElement = document.getElementById(`led-gpio${pin}`);
    // console.log(pin, gpioState)
    if (gpioState === 1) {
        ledElement.style.backgroundColor = 'green';
    } else {
        ledElement.style.backgroundColor = 'red';
    }
    // logMessage('updateGPIOState finished')
}

async function setGPIO(pin, state) {
    // Implement GPIO set using WebHID API
    if (!i2c_host_adapter_name.toLowerCase().includes('MCP'.toLowerCase())) {
        logMessage('Only MCP2221A supports setGPIO function')
        return {message:'Only MCP2221A supports setGPIO function', status: false}
    }
    if (i2c_host_adapter.device.opened) {
        logMessage(`setGPIO pin ${pin}, ${state}`)
        const gpioState = await i2c_host_adapter.gpioSetPin(pin, state)
        updateGPIOState(pin, gpioState)
        return false
    } else {
        logMessage(`${i2c_host_adapter_name} not connected`)
        return {message:'Only MCP2221A supports setGPIO function', status: false}
    }
}

async function toggleGPIO(pin) {
    if (!i2c_host_adapter_name.toLowerCase().includes('MCP'.toLowerCase())) {
        logMessage('Only MCP2221A supports setGPIO function')
        return {message:'Only MCP2221A supports setGPIO function', status: false}
    }
    if (i2c_host_adapter.device.opened) {
        const gpioState = await i2c_host_adapter.toggleGpioPin(pin)
        console.log('gpioState',gpioState)
        logMessage(`toggleGPIO pin ${pin} to ${gpioState}`)
        updateGPIOState(pin, gpioState)
    } else {
        logMessage(`${i2c_host_adapter_name} not connected`)
        return {message:'Only MCP2221A supports setGPIO function', status: false}
    }
}

function logMessage(...messages) {
  const log = document.getElementById('log');
  const combinedMessage = messages.join(' ')
  const timestamp = new Date().toLocaleTimeString('en-US');
  log.textContent += `[${timestamp}] ${combinedMessage}\n`;
  log.scrollTop = log.scrollHeight; // Scroll to the bottom
}

function clearlogMessage() {
    const log = document.getElementById('log');
    log.textContent = '';
    log.scrollTop = log.scrollHeight; // Scroll to the bottom
  }

function extractlogMessage() {
    const log = document.getElementById('log');
    const logText = "data:text/csv;charset=utf-8,"+log.textContent;
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/:/g, '');

    const fileName = `log_dump_${timestamp}.csv`;
    let encodedUri = encodeURI(logText);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    // 다운로드 링크를 클릭해서 파일 다운로드를 트리거
    document.body.appendChild(link); // 필요한 경우에만 추가
    link.click();
    document.body.removeChild(link); // 클릭 후 링크 제거
  }


function hexString(num) {
    return num.toString(16).toUpperCase().padStart(4, '0x')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function findSequence(arr, sequence) {
    const seqLength = sequence.length;

    for (let i = 0; i <= arr.length - seqLength; i++) {
        let found = true;

        for (let j = 0; j < seqLength; j++) {
            if (arr[i + j] !== sequence[j]) {
                found = false;
                break;
            }
        }

        if (found) {
            return i; // 첫 번째 매칭된 시퀀스의 시작 인덱스 반환
        }
    }

    return -1; // 시퀀스를 찾지 못한 경우
}
