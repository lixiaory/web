// 格式化消息文本
function formatMessage(text) {
    if (!text) return '';
    
    // 处理标题和换行
    let lines = text.split('\n');
    let formattedLines = lines.map(line => {
        // 处理标题（**文本**）
        line = line.replace(/\*\*(.*?)\*\*/g, '<span class="bold-text">$1</span>');
        return line;
    });
    
    // 将 ### 替换为换行，并确保每个部分都是一个段落
    let processedText = formattedLines.join('\n');
    let sections = processedText
        .split('###')
        .filter(section => section.trim())
        .map(section => {
            // 移除多余的换行和空格
            let lines = section.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) return '';
            
            // 处理每个部分
            let result = '';
            let currentIndex = 0;
            
            while (currentIndex < lines.length) {
                let line = lines[currentIndex].trim();
                
                // 如果是数字开头（如 "1.")
                if (/^\d+\./.test(line)) {
                    result += `<p class="section-title">${line}</p>`;
                }
                // 如果是小标题（以破折号开头）
                else if (line.startsWith('-')) {
                    result += `<p class="subsection"><span class="bold-text">${line.replace(/^-/, '').trim()}</span></p>`;
                }
                // 如果是正文（包含冒号的行）
                else if (line.includes(':')) {
                    let [subtitle, content] = line.split(':').map(part => part.trim());
                    result += `<p><span class="subtitle">${subtitle}</span>: ${content}</p>`;
                }
                // 普通文本
                else {
                    result += `<p>${line}</p>`;
                }
                currentIndex++;
            }
            return result;
        });
    
    return sections.join('');
}

// 显示消息
function displayMessage(role, message) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}`;
    
    const avatar = document.createElement('img');
    avatar.src = role === 'user' ? 'user-avatar.png' : 'bot-avatar.png';
    avatar.alt = role === 'user' ? 'User' : 'Bot';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 用户消息直接显示，机器人消息需要格式化
    messageContent.innerHTML = role === 'user' ? message : formatMessage(message);

    messageElement.appendChild(avatar);
    messageElement.appendChild(messageContent);
    messagesContainer.appendChild(messageElement);
    
    // 平滑滚动到底部
    messageElement.scrollIntoView({ behavior: 'smooth' });
}

function sendMessage() {
    const inputElement = document.getElementById('chat-input');
    const message = inputElement.value;
    if (!message.trim()) return;

    displayMessage('user', message);
    inputElement.value = '';

    // 显示加载动画
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }

    // 阿里云DashScope API配置
    const apiKey = ''; // 替换为您的有效API Key
    const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

    // 构建请求体，符合DashScope原生API格式
    const payload = {
        model: "qwen-plus", // 使用qwen-plus模型
        input: {
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant."
                },
                {
                    role: "user",
                    content: message
                }
            ]
        },
        parameters: {
            result_format: "message" // 返回消息格式
        }
    };

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`, // DashScope使用Bearer认证
            // 移除了异步调用头，使用同步调用
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        // 首先检查HTTP状态码
        if (!response.ok) {
            // 尝试解析错误响应体
            return response.json().then(errorData => {
                // 创建一个包含状态码和错误信息的错误对象
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.response = response;
                error.data = errorData;
                throw error;
            }).catch(() => {
                // 如果解析JSON失败，抛出原始错误
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        // 处理DashScope API响应
        if (data.output && data.output.choices && data.output.choices.length > 0) {
            // 获取助手回复内容
            const assistantMessage = data.output.choices[0].message;
            if (assistantMessage.role === 'assistant' && assistantMessage.content) {
                displayMessage('bot', assistantMessage.content);
            } else {
                displayMessage('bot', '出错了：响应格式不正确');
                console.error('无效的响应格式:', data);
            }
        } else if (data.code) {
            displayMessage('bot', `API错误: ${data.code} - ${data.message}`);
        } else {
            displayMessage('bot', '出错了：未知的响应格式');
            console.error('未知的响应格式:', data);
        }
    })
    .catch(error => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        let errorMessage = '请求失败：';
        
        // 处理不同类型的错误
        if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += '未知错误';
        }
        
        // 如果有响应数据，添加详细信息
        if (error.data) {
            if (error.data.code && error.data.message) {
                errorMessage += ` (${error.data.code}: ${error.data.message})`;
            } else if (error.data.message) {
                errorMessage += ` (${error.data.message})`;
            }
        }
        
        displayMessage('bot', errorMessage);
        console.error('API请求错误:', error);
    });
}

// 主题切换功能
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const chatContainer = document.querySelector('.chat-container');
    const messages = document.querySelector('.messages');
    
    // 同时切换容器的深色模式
    chatContainer.classList.toggle('dark-mode');
    messages.classList.toggle('dark-mode');
    
    // 保存主题设置
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

// 页面加载时检查主题设置
document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.querySelector('.chat-container').classList.add('dark-mode');
        document.querySelector('.messages').classList.add('dark-mode');
    }
});

// 下拉菜单功能
function toggleDropdown(event) {
    event.preventDefault();
    document.getElementById('dropdownMenu').classList.toggle('show');
}

// 点击其他地方关闭下拉菜单
window.onclick = function(event) {
    if (!event.target.matches('.dropdown button')) {
        const dropdowns = document.getElementsByClassName('dropdown-content');
        for (const dropdown of dropdowns) {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    }
}

// 回车发送功能
document.getElementById('chat-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
