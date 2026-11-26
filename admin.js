// =========================================
// CHAOS! - ESPACE ADMINISTRATEUR
// L'accès et les modifications sont protégés par RLS dans Supabase.
// =========================================

const feedback = document.getElementById('admin-feedback');
const ordersList = document.getElementById('admin-orders-list');
const statusFilter = document.getElementById('status-filter');
const searchInput = document.getElementById('order-search');
const refreshButton = document.getElementById('refresh-orders');

let allOrders = [];
let busy = false;

const statusLabels = {
    pending: 'En attente',
    accepted: 'Acceptée',
    declined: 'Refusée',
    completed: 'Terminée'
};

function setFeedback(message, type = '') {
    feedback.textContent = message;
    feedback.className = `admin-feedback ${type}`.trim();
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? `${amount.toLocaleString('fr-FR')} €`
        : 'À confirmer';
}

function createStatusBadge(status) {
    return makeElement('span', `admin-status status-${status}`, statusLabels[status] || status);
}

function createOrderCard(order) {
    const card = makeElement('article', 'admin-order-card');

    const top = makeElement('div', 'admin-order-top');
    const reference = makeElement('div', 'admin-order-reference', `COMMANDE #${String(order.id).slice(0, 8).toUpperCase()}`);
    const badge = createStatusBadge(order.status);
    top.append(reference, badge);

    const date = makeElement('p', 'admin-order-date', `Reçue le ${formatDate(order.created_at)}`);
    const customer = makeElement('div', 'admin-customer');
    customer.append(
        makeElement('h3', '', order.customer_name || 'Client sans nom'),
        makeElement('a', 'admin-email', order.customer_email || 'E-mail non renseigné')
    );
    const emailLink = customer.querySelector('a');
    if (order.customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email)) {
        emailLink.href = `mailto:${order.customer_email}`;
    } else {
        emailLink.removeAttribute('href');
    }

    const spec = makeElement('p', 'admin-order-spec', `${order.style || 'Style non renseigné'} · Format ${String(order.format || 'non renseigné').toLowerCase()}`);
    const quantity = makeElement('p', 'admin-order-quantity', `${order.quantity} dessin${Number(order.quantity) > 1 ? 's' : ''} · ${formatPrice(order.unit_price)} / dessin`);
    const description = makeElement('p', 'admin-order-description', order.description || 'Aucune description fournie.');

    card.append(top, date, customer, spec, quantity, description);

    if (order.reference_url) {
        try {
            const referenceUrl = new URL(order.reference_url);
            if (referenceUrl.protocol === 'https:' || referenceUrl.protocol === 'http:') {
                const link = makeElement('a', 'admin-reference-link', 'Ouvrir l’image de référence ↗');
                link.href = referenceUrl.href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                card.append(link);
            }
        } catch (_) {
            // Ignore les URL de référence invalides.
        }
    }

    const bottom = makeElement('div', 'admin-order-bottom');
    const total = makeElement('div', 'admin-order-total');
    total.append(
        makeElement('small', '', 'PRIX ESTIMÉ'),
        makeElement('strong', '', formatPrice(order.total_price))
    );

    const actions = makeElement('div', 'admin-order-actions');
    const chatButton = makeElement('button', 'admin-chat-trigger', 'OUVRIR LA MESSAGERIE ↗');
    chatButton.type = 'button';
    chatButton.dataset.chatOrderId = order.id;
    chatButton.dataset.chatOrderLabel = `CLIENT : ${order.customer_name || 'COMMANDE'} · #${String(order.id).slice(0, 8).toUpperCase()}`;
    actions.append(chatButton);

    if (order.status === 'pending') {
        actions.append(
            makeActionButton('ACCEPTER', 'accept', order.id),
            makeActionButton('REFUSER', 'decline', order.id)
        );
    } else if (order.status === 'accepted') {
        actions.append(makeActionButton('MARQUER TERMINÉE', 'complete', order.id));
    }

    bottom.append(total, actions);
    card.append(bottom);
    return card;
}

function makeActionButton(label, action, orderId) {
    const button = makeElement('button', `admin-action-button action-${action}`, label);
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.orderId = orderId;
    return button;
}

function renderOrders() {
    ordersList.replaceChildren();

    const selectedStatus = statusFilter.value;
    const query = searchInput.value.trim().toLocaleLowerCase('fr-FR');
    const visibleOrders = allOrders.filter(order => {
        const statusMatches = selectedStatus === 'all' || order.status === selectedStatus;
        const text = [order.customer_name, order.customer_email, order.description, order.id]
            .filter(Boolean).join(' ').toLocaleLowerCase('fr-FR');
        return statusMatches && (!query || text.includes(query));
    });

    if (visibleOrders.length === 0) {
        ordersList.append(makeElement('div', 'admin-empty', 'Aucune commande ne correspond à ce filtre.'));
        return;
    }

    const fragment = document.createDocumentFragment();
    visibleOrders.forEach(order => fragment.append(createOrderCard(order)));
    ordersList.append(fragment);
}

async function loadOrders() {
    if (busy) return;
    busy = true;
    refreshButton.disabled = true;
    setFeedback('Chargement des commandes...', 'loading');

    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('id, user_id, customer_name, customer_email, description, reference_url, quantity, format, style, unit_price, total_price, status, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        allOrders = data || [];
        renderOrders();
        setFeedback(`${allOrders.length} commande${allOrders.length > 1 ? 's' : ''} au total.`, 'success');
    } catch (error) {
        console.error('Chargement des commandes impossible :', error);
        setFeedback(`Impossible de charger les commandes : ${error.message || 'erreur inconnue'}`, 'error');
    } finally {
        busy = false;
        refreshButton.disabled = false;
    }
}

async function updateOrderStatus(orderId, newStatus, button) {
    const labels = {
        accepted: 'ACCEPTER',
        declined: 'REFUSER',
        completed: 'MARQUER COMME TERMINÉE'
    };

    if (!labels[newStatus]) return;
    const selectedOrder = allOrders.find(item => item.id === orderId);
    const clientName = selectedOrder?.customer_name || 'ce client';
    const reference = String(orderId).slice(0, 8).toUpperCase();
    const confirmation = `Tu vas ${labels[newStatus].toLowerCase()} la commande #${reference} de ${clientName}.\n\nConfirmer cette action ?`;
    if (!window.confirm(confirmation)) return;

    button.disabled = true;
    button.textContent = 'MISE À JOUR...';
    setFeedback('Mise à jour du statut...', 'loading');

    try {
        // Seule la colonne status est modifiée. Les tarifs ne peuvent pas être changés depuis cette page.
        const { data, error } = await supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId)
            .select('id, status')
            .single();

        if (error) throw error;
        const order = allOrders.find(item => item.id === orderId);
        if (order) order.status = data.status;
        renderOrders();
        setFeedback(`Commande mise à jour : ${statusLabels[data.status]}.`, 'success');
    } catch (error) {
        console.error('Modification du statut impossible :', error);
        setFeedback(`La modification a échoué : ${error.message || 'erreur inconnue'}`, 'error');
        button.disabled = false;
    }
}

async function initialiseAdmin() {
    if (typeof supabaseClient === 'undefined') {
        setFeedback('Supabase ne se charge pas. Vérifie l’ordre des scripts dans admin.html.', 'error');
        return;
    }

    try {
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
            window.location.replace('connexion.html');
            return;
        }

        const { data: isAdmin, error: roleError } = await supabaseClient.rpc('is_chaos_admin');
        if (roleError) throw roleError;
        if (isAdmin !== true) {
            setFeedback('Accès refusé : ce compte n’est pas autorisé à gérer les commandes.', 'error');
            ordersList.replaceChildren();
            return;
        }

        await loadOrders();
    } catch (error) {
        console.error('Vérification des droits admin impossible :', error);
        setFeedback(`Impossible de vérifier les droits administrateur : ${error.message || 'vérifie le script SQL'}`, 'error');
    }
}

refreshButton.addEventListener('click', loadOrders);
statusFilter.addEventListener('change', renderOrders);
searchInput.addEventListener('input', renderOrders);
ordersList.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const actionToStatus = {
        accept: 'accepted',
        decline: 'declined',
        complete: 'completed'
    };
    const nextStatus = actionToStatus[button.dataset.action];
    if (nextStatus) updateOrderStatus(button.dataset.orderId, nextStatus, button);
});

initialiseAdmin();
