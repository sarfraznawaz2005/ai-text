document.addEventListener('DOMContentLoaded', function () {
    const config = window.ai_text_config;

    validateConfig(config);

    function addIconToElement(element) {
        const icon = document.createElement('span');
        icon.className = 'ai-text-icon';
        icon.title = 'AI Text';
        icon.innerHTML = '✨'; // Use a magic wand icon
        element.insertAdjacentElement('beforebegin', icon);

        icon.addEventListener('click', function () {
            openModal(element);
        });
    }

    function handleExistingElements() {
        const elements = document.querySelectorAll(config.target_element);
        elements.forEach(element => addIconToElement(element));
    }

    handleExistingElements();

    document.body.addEventListener('DOMNodeInserted', function (event) {
        const target = event.target;
        
        if (target.nodeType === Node.ELEMENT_NODE && target.matches(config.target_element)) {
            addIconToElement(target);
        }
    });

    function createModalContent(targetElement, config) {
        const modal = document.createElement('dialog');
        modal.className = 'ai-text-modal';

        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerText = 'Close';
        closeButton.addEventListener('click', () => modal.close());

        const responseDiv = document.createElement('div');
        responseDiv.className = 'ai-text-response';
        responseDiv.contentEditable = true; // Make it content editable
        responseDiv.innerHTML = targetElement.value.replace(/\n/g, '<br>'); // Convert new lines to <br> for display

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'ai-text-buttons';

        const toneLabel = document.createElement('p');
        toneLabel.className = 'tone-label';
        toneLabel.innerText = 'Click a Tone';
        buttonsDiv.appendChild(toneLabel);

        const toneButtonsDiv = document.createElement('div');
        toneButtonsDiv.className = 'tone-buttons';
        buttonsDiv.appendChild(toneButtonsDiv);

        Object.keys(config.tones).forEach(tone => {
            const button = document.createElement('button');
            button.className = 'ai-text-tone-button';
            button.innerText = tone.charAt(0).toUpperCase() + tone.slice(1);
            button.addEventListener('click', () => applyTone(button, tone, targetElement.value, modal));
            toneButtonsDiv.appendChild(button);
        });

        const separator = document.createElement('hr');
        separator.className = 'modal-separator';

        const applyButton = document.createElement('button');
        applyButton.className = 'apply-button';
        applyButton.innerText = 'Apply';
        applyButton.disabled = true;
        applyButton.addEventListener('click', () => {
            applyChangesToTextarea(targetElement, responseDiv.innerHTML);
            modal.close();
        });

        const actionButtonsDiv = document.createElement('div');
        actionButtonsDiv.className = 'action-buttons';
        actionButtonsDiv.appendChild(applyButton);
        actionButtonsDiv.appendChild(closeButton);

        modal.appendChild(responseDiv);
        modal.appendChild(buttonsDiv);
        modal.appendChild(separator);
        modal.appendChild(actionButtonsDiv);

        return modal;
    }

    function openModal(targetElement) {
        const modal = createModalContent(targetElement, config);
        document.body.appendChild(modal);
        modal.showModal();

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.close();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                modal.close();
            }
        }, { once: true });
    }

    function applyTone(button, tone, text, modal) {
        const responseDiv = modal.querySelector('.ai-text-response');
        const applyButton = modal.querySelector('.apply-button');

        // Disable tone buttons
        const toneButtons = modal.querySelectorAll('.ai-text-tone-button');
        toneButtons.forEach(btn => btn.disabled = true);
        button.classList.add('disabled-button');

        // Simulate API call to AI
        fetchAIResponse(text, config.tones[tone], config)
            .then(response => {
                responseDiv.innerHTML = response.replace(/\n/g, '<br>'); // Convert new lines to <br> for display
                responseDiv.style.color = 'black';
                applyButton.disabled = false;
            })
            .catch(error => {
                responseDiv.innerText = 'Error fetching response, please try again: ' + error.message;
                responseDiv.style.color = 'red';
                applyButton.disabled = true;
                responseDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            })
            .finally(() => {
                toneButtons.forEach(btn => btn.disabled = false);
                button.classList.remove('disabled-button');
            });
    }

    function fetchAIResponse(text, prompt, config) {
        const apiUrl = getApiUrl(config.llm_provider, config);

        let postData = {
            prompt: `${prompt}\n\n${text}`,
            max_tokens: 8192
        };

        if (config.llm_provider === 'gemini') {
            postData = {
                contents: [{
                    role: 'user',
                    parts: [{ text: `${prompt}\n\n${text}` }]
                }],
                generationConfig: {
                    maxOutputTokens: 8192,
                    //temperature: 1.0
                }
            };
        }

        return fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        })
            .then(response => response.json())
            .then(data => {
                if (config.llm_provider === 'gemini') {
                    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                        return data.candidates[0].content.parts[0].text.trim();
                    } else {
                        throw new Error("Unexpected response format");
                    }
                } else {
                    return data.choices[0].text.trim();
                }
            });
    }

    function getApiUrl(provider, config) {
        switch (provider) {
            case 'openai':
                return 'https://api.openai.com/v1/completions';
            case 'gemini':
                return `https://generativelanguage.googleapis.com/v1/models/${config.llm_model}:generateContent?key=${config.llm_key}`;
            case 'ollama':
                return 'https://api.ollama.ai/v1/completions';
            default:
                throw new Error('Unsupported LLM provider');
        }
    }

    function validateConfig(config) {
        const requiredFields = ['target_element', 'tones', 'llm_provider', 'llm_model', 'llm_key'];
        for (const field of requiredFields) {
            if (!config[field]) {
                throw new Error(`Missing required configuration field: ${field}`);
            }
        }
    }

    function applyChangesToTextarea(targetElement, newText) {
        // Convert <br> tags to new lines for the textarea value
        const formattedText = newText.replace(/<br\s*\/?>/g, '\n');

        targetElement.value = formattedText;
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
});
