// =====================================================
// CHAOS! - MESSAGERIE PRIVEE PAR COMMANDE
// Charge depuis mon-compte.html et admin.html.
// L'acces aux conversations est egalement protege par RLS.
// =====================================================
(() => {
    "use strict";

    if (typeof supabaseClient === "undefined") {
        console.error("Messagerie CHAOS! : supabaseClient est introuvable.");
        return;
    }

    let currentUser = null;
    let activeOrderId = null;
    let activeChannel = null;
    let pollingTimer = null;
    let loadingMessages = false;
    let sendingMessage = false;

    const isAdminView = document.body.classList.contains("admin-page");

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // Le contenu statique est fixe. Les messages saisis par les utilisateurs
    // sont toujours affiches avec textContent, jamais interpretes comme HTML.
    const modal = el("div", "chaos-chat-modal");
    modal.hidden = true;
    modal.innerHTML = `
        <button type="button" class="chaos-chat-backdrop" data-chat-close aria-label="Fermer la messagerie"></button>
        <section class="chaos-chat-panel" role="dialog" aria-modal="true" aria-labelledby="chaos-chat-title">
            <header class="chaos-chat-header">
                <div>
                    <p class="chaos-chat-eyebrow">PRIVATE PROJECT CHAT // CHAOS!</p>
                    <h2 id="chaos-chat-title">ORDER <span>MESSAGES.</span></h2>
                    <p class="chaos-chat-subtitle" id="chaos-chat-reference"></p>
                </div>
                <div class="chaos-chat-header-actions">
                    <button type="button" class="chaos-chat-refresh" id="chaos-chat-refresh" aria-label="Actualiser les messages" title="Actualiser">↻</button>
                    <button type="button" class="chaos-chat-close" data-chat-close aria-label="Fermer">×</button>
                </div>
            </header>
            <p class="chaos-chat-feedback" id="chaos-chat-feedback" role="status" aria-live="polite">Chargement de la conversation...</p>
            <div class="chaos-chat-messages" id="chaos-chat-messages" aria-live="polite"></div>
            <form class="chaos-chat-form" id="chaos-chat-form">
                <label class="chaos-chat-label" for="chaos-chat-input">TON MESSAGE</label>
                <textarea id="chaos-chat-input" rows="3" maxlength="3000" placeholder="Ecris ton message ici..." required></textarea>
                <div class="chaos-chat-form-bottom">
                    <small>3000 caracteres maximum · Reste respectueux et precis.</small>
                    <button type="submit" class="chaos-chat-send" id="chaos-chat-send">ENVOYER ↗</button>
                </div>
            </form>
        </section>
    `;
    document.body.appendChild(modal);

    const titleReference = modal.querySelector("#chaos-chat-reference");
    const feedback = modal.querySelector("#chaos-chat-feedback");
    const messagesBox = modal.querySelector("#chaos-chat-messages");
    const form = modal.querySelector("#chaos-chat-form");
    const input = modal.querySelector("#chaos-chat-input");
    const sendButton = modal.querySelector("#chaos-chat-send");
    const refreshButton = modal.querySelector("#chaos-chat-refresh");

    function setFeedback(message, type = "") {
        feedback.textContent = message;
        feedback.className = `chaos-chat-feedback ${type}`.trim();
    }

    function formatMessageDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Date inconnue";
        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        }).format(date);
    }

    function closeChat() {
        modal.hidden = true;
        document.body.classList.remove("chaos-chat-open");
        activeOrderId = null;
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
        if (activeChannel) {
            supabaseClient.removeChannel(activeChannel).catch(error => {
                console.warn("Fermeture du canal de messagerie :", error);
            });
            activeChannel = null;
        }
        messagesBox.replaceChildren();
        input.value = "";
    }

    function appendMessage(message) {
        const mine = message.sender_id === currentUser.id;
        const wrapper = el("article", `chaos-chat-message ${mine ? "mine" : "theirs"}`);
        const meta = el("div", "chaos-chat-message-meta");
        const author = mine ? "MOI" : (isAdminView ? "CLIENT" : "CHAOS!");
        meta.append(el("strong", "", author), el("time", "", formatMessageDate(message.created_at)));
        const body = el("p", "chaos-chat-message-content", message.content);
        wrapper.append(meta, body);
        messagesBox.appendChild(wrapper);
    }

    async function loadMessages(scrollToBottom = true) {
        if (!activeOrderId || loadingMessages) return;
        loadingMessages = true;
        refreshButton.disabled = true;

        try {
            const { data, error } = await supabaseClient
                .from("order_messages")
                .select("id, order_id, sender_id, content, created_at")
                .eq("order_id", activeOrderId)
                .order("created_at", { ascending: true });

            if (error) throw error;

            messagesBox.replaceChildren();
            if (!data || data.length === 0) {
                messagesBox.append(el("p", "chaos-chat-empty", "Aucun message pour le moment. Envoie le premier message pour commencer la discussion !"));
            } else {
                const fragment = document.createDocumentFragment();
                data.forEach(message => {
                    const mine = message.sender_id === currentUser.id;
                    const wrapper = el("article", `chaos-chat-message ${mine ? "mine" : "theirs"}`);
                    const meta = el("div", "chaos-chat-message-meta");
                    const author = mine ? "MOI" : (isAdminView ? "CLIENT" : "CHAOS!");
                    meta.append(el("strong", "", author), el("time", "", formatMessageDate(message.created_at)));
                    wrapper.append(meta, el("p", "chaos-chat-message-content", message.content));
                    fragment.appendChild(wrapper);
                });
                messagesBox.appendChild(fragment);
            }

            setFeedback(`${data?.length || 0} message${(data?.length || 0) > 1 ? "s" : ""} dans cette conversation.`, "success");
            if (scrollToBottom) messagesBox.scrollTop = messagesBox.scrollHeight;
        } catch (error) {
            console.error("Chargement des messages impossible :", error);
            setFeedback(`Impossible de charger la conversation : ${error.message || "vérifie le script SQL de messagerie"}`, "error");
        } finally {
            loadingMessages = false;
            refreshButton.disabled = false;
        }
    }

    async function openChat(orderId, orderLabel = "") {
        if (!orderId) return;

        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) throw error;
            if (!data.user) {
                window.location.href = "connexion.html?next=" + encodeURIComponent(isAdminView ? "admin.html" : "mon-compte.html");
                return;
            }
            currentUser = data.user;
            activeOrderId = orderId;
            const shortId = String(orderId).slice(0, 8).toUpperCase();
            titleReference.textContent = orderLabel || `COMMANDE #${shortId}`;
            modal.hidden = false;
            document.body.classList.add("chaos-chat-open");
            setFeedback("Chargement de la conversation...", "loading");
            input.value = "";
            input.focus();

            await loadMessages();

            // Ecoute instantanee si Realtime est disponible.
            if (activeChannel) {
                await supabaseClient.removeChannel(activeChannel);
                activeChannel = null;
            }
            activeChannel = supabaseClient
                .channel(`chaos-order-chat-${orderId}-${Date.now()}`)
                .on("postgres_changes", {
                    event: "INSERT",
                    schema: "public",
                    table: "order_messages",
                    filter: `order_id=eq.${orderId}`
                }, () => loadMessages())
                .subscribe();

            // Repli automatique au cas ou Realtime n'est pas disponible.
            if (pollingTimer) clearInterval(pollingTimer);
            pollingTimer = setInterval(() => loadMessages(false), 8000);
        } catch (error) {
            console.error("Ouverture de la messagerie impossible :", error);
            setFeedback(`Impossible d'ouvrir la conversation : ${error.message || "erreur inconnue"}`, "error");
            modal.hidden = false;
            document.body.classList.add("chaos-chat-open");
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const content = input.value.trim();
        if (!activeOrderId || !currentUser || !content || sendingMessage) return;
        if (content.length > 3000) {
            setFeedback("Ton message dépasse la limite de 3000 caractères.", "error");
            return;
        }

        sendingMessage = true;
        sendButton.disabled = true;
        sendButton.textContent = "ENVOI...";
        try {
            const { error } = await supabaseClient
                .from("order_messages")
                .insert({
                    order_id: activeOrderId,
                    sender_id: currentUser.id,
                    content
                });
            if (error) throw error;
            input.value = "";
            await loadMessages();
        } catch (error) {
            console.error("Envoi du message impossible :", error);
            setFeedback(`Le message n'a pas pu être envoyé : ${error.message || "vérifie les autorisations Supabase"}`, "error");
        } finally {
            sendingMessage = false;
            sendButton.disabled = false;
            sendButton.textContent = "ENVOYER ↗";
            input.focus();
        }
    });

    document.addEventListener("click", event => {
        const trigger = event.target.closest("[data-chat-order-id]");
        if (trigger) {
            event.preventDefault();
            openChat(trigger.dataset.chatOrderId, trigger.dataset.chatOrderLabel || "");
            return;
        }
        if (event.target.closest("[data-chat-close]")) closeChat();
    });

    refreshButton.addEventListener("click", () => loadMessages());
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) closeChat();
    });

    // Expose une API minimale pour les autres scripts du site.
    window.ChaosOrderChat = { open: openChat, close: closeChat };
})();
