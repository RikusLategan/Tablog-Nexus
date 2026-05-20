import { InventoryItem } from '../types';

export const DEFAULT_CUSTOM_TEMPLATE = `IF entry[n].Task=="DONE" {- entry[n].Task <entry[n].time.HH:entry[n].time.MM> entry[n].Item entry[n].QTY entry[n].Notes[0]
  :LOGBOOK:
  CLOCK: [entry[n].year.YYYY-entry[n].month.MM-entry[n].day.DD entry[n].day.Day entry[n].time.HH:entry[n].time.MM:entry[n].time.SS--entry[n].stopwatch.pause.YYYY-entry[n].stopwatch.pause.MM-entry[n].stopwatch.pause.DD entry[n].stopwatch.pause.day.Day entry[n].stopwatch.pause.HH:entry[n].stopwatch.pause.MIN:entry[n].stopwatch.pause.SS] =>  entry[n].stopwatch.HH:entry[n].stopwatch.MM:entry[n].stopwatch.SS
  :END:
  entry[n].Notes[l+1]}
ELSEIF entry[n].Task=="NOW" {- entry[n].Task <entry[n].time.HH:entry[n].time.MM> entry[n].Item entry[n].QTY entry[n].Notes[0]
  :LOGBOOK:
  CLOCK: [entry[n].year.YYYY-entry[n].month.MM-entry[n].day.DD entry[n].day.Day entry[n].time.HH:entry[n].time.MM:entry[n].time.SS]
  :END:
  entry[n].Notes[l+1]}
ELSE {- <entry[n].time.HH:entry[n].time.MM> entry[n].Item entry[n].QTY entry[n].Notes[0]
  entry[n].Notes[l+1]}`;

function evaluateCondition(cond: string, item: InventoryItem): boolean {
    const task = (!item.taskStatus || item.taskStatus === "NONE") ? '' : item.taskStatus;
    const cat = (!item.category || item.category === "(No Item)") ? '' : item.category;
    let evalCond = cond;
    evalCond = evalCond.replace(/entry\[(?:n|\d*)\]\.(?:task)/ig, task);
    evalCond = evalCond.replace(/entry\[(?:n|\d*)\]\.(?:category|item)/ig, cat);
    
    const match = evalCond.match(/(.*?)(==|!=)(.*)/);
    if (match) {
        let left = match[1].trim().replace(/^["']|["']$/g, '');
        let op = match[2];
        let right = match[3].trim().replace(/^["']|["']$/g, '');
        if (op === '==') return left === right;
        if (op === '!=') return left !== right;
    }
    return false;
}

function processConditionals(template: string, item: InventoryItem): string {
    let result = '';
    let i = 0;
    while (i < template.length) {
        let searchArea = template.substring(i);
        let ifMatch = searchArea.match(/IF\s+([^\{]+)\{/i);
        
        if (!ifMatch) {
            result += searchArea;
            break;
        }

        let matchIndex = searchArea.indexOf(ifMatch[0]);
        result += searchArea.substring(0, matchIndex);
        i += matchIndex;
        
        searchArea = template.substring(i);
        let currentIf = searchArea.match(/^IF\s+([^\{]+)\{/i);
        if (!currentIf) break;
        
        let blockStart = i + currentIf[0].length;
        let blockEnd = template.indexOf('}', blockStart);
        if (blockEnd === -1) {
            result += template.substring(i);
            break;
        }
        
        let blocks: {cond: string, content: string}[] = [];
        let elseContent: string | null = null;
        
        blocks.push({ cond: currentIf[1].trim(), content: template.substring(blockStart, blockEnd) });
        
        i = blockEnd + 1;
        
        while (i < template.length) {
            let spaceMatch = template.substring(i).match(/^\s+/);
            let checkPos = i + (spaceMatch ? spaceMatch[0].length : 0);
            let nextText = template.substring(checkPos);
            
            if (nextText.toUpperCase().startsWith('ELSEIF')) {
                let eifMatch = nextText.match(/^ELSEIF\s+([^\{]+)\{/i);
                if (eifMatch) {
                    blockStart = checkPos + eifMatch[0].length;
                    blockEnd = template.indexOf('}', blockStart);
                    if (blockEnd !== -1) {
                        blocks.push({ cond: eifMatch[1].trim(), content: template.substring(blockStart, blockEnd) });
                        i = blockEnd + 1;
                        continue;
                    }
                }
            } else if (nextText.toUpperCase().startsWith('ELSE') && !nextText.toUpperCase().startsWith('ELSEIF')) {
                let elseMatch = nextText.match(/^ELSE\s*\{/i);
                if (elseMatch) {
                    blockStart = checkPos + elseMatch[0].length;
                    blockEnd = template.indexOf('}', blockStart);
                    if (blockEnd !== -1) {
                        elseContent = template.substring(blockStart, blockEnd);
                        i = blockEnd + 1;
                        continue;
                    }
                }
            }
            break; 
        }
        
        let matched = false;
        for (let b of blocks) {
            if (evaluateCondition(b.cond, item)) {
                result += processConditionals(b.content, item);
                matched = true;
                break;
            }
        }
        if (!matched && elseContent !== null) {
            result += processConditionals(elseContent, item);
        }
    }
    
    return result;
}

export function calculateDepths(itemsToExport: InventoryItem[], allItemsInContext: InventoryItem[]): { item: InventoryItem; depth: number }[] {
    const itemMap = new Map<string, InventoryItem>();
    allItemsInContext.forEach(i => { if (i.id) itemMap.set(i.id, i); });

    const getDepth = (item: InventoryItem): number => {
        let d = 0;
        let curr = item;
        while (curr.parentId && itemMap.has(curr.parentId)) {
            d++;
            curr = itemMap.get(curr.parentId)!;
            if (d > 20) break;
        }
        return d;
    };

    return itemsToExport.map(item => ({
        item,
        depth: getDepth(item)
    }));
}

export const parseCustomTemplate = (item: InventoryItem, temp: string, index: number = 0, depth: number = 0) => {
    temp = processConditionals(temp, item);
    
    const d = item.loggedAt?.toDate?.() || item.createdAt?.toDate?.() || new Date();
    const YYYY = d.getFullYear().toString();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    const DDD = d.toLocaleDateString('en-US', { weekday: 'short' });
    const HH = String(d.getHours()).padStart(2, '0');
    const MIN = String(d.getMinutes()).padStart(2, '0');
    const SS = String(d.getSeconds()).padStart(2, '0');
    
    let res = temp;
    res = res.replace(/entry\[(?:n|\d*)\]\.year\.YYYY/ig, YYYY);
    res = res.replace(/entry\[(?:n|\d*)\]\.month\.MM/ig, MM);
    res = res.replace(/entry\[(?:n|\d*)\]\.day\.DD/ig, DD);
    res = res.replace(/entry\[(?:n|\d*)\]\.day\.Day/ig, DDD);
    res = res.replace(/entry\[(?:n|\d*)\]\.time\.HH/ig, HH);
    res = res.replace(/entry\[(?:n|\d*)\]\.time\.MM/ig, MIN);
    res = res.replace(/entry\[(?:n|\d*)\]\.time\.SS/ig, SS);
    
    let elapsedMs = item.stopwatchElapsedMs || 0;
    if (item.hasStopwatch && !item.isStopwatchPaused && item.stopwatchLastResumedAt) {
        // Technically this gives the duration "right now" instead of when it was logged/exported, but it works
        elapsedMs += Date.now() - item.stopwatchLastResumedAt;
    }
    
    const stopHH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
    const stopMM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
    const stopSS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');
    
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.HH/ig, stopHH);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.MM/ig, stopMM);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.SS/ig, stopSS);

    const pDate = item.stopwatchLastPausedAt ? new Date(item.stopwatchLastPausedAt) : null;
    const pYYYY = pDate ? pDate.getFullYear().toString() : '';
    const pMM = pDate ? String(pDate.getMonth() + 1).padStart(2, '0') : '';
    const pDD = pDate ? String(pDate.getDate()).padStart(2, '0') : '';
    const pDDD = pDate ? pDate.toLocaleDateString('en-US', { weekday: 'short' }) : '';
    const pHH = pDate ? String(pDate.getHours()).padStart(2, '0') : '';
    const pMIN = pDate ? String(pDate.getMinutes()).padStart(2, '0') : '';
    const pSS = pDate ? String(pDate.getSeconds()).padStart(2, '0') : '';
    
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.pause\.YYYY/ig, pYYYY);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch(?:\.pause)?\.month\.MM/ig, pMM);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch(?:\.pause)?\.day\.DD/ig, pDD);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.pause\.MM/ig, pMM);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.pause\.DD/ig, pDD);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch(?:\.pause)?\.day\.Day/ig, pDDD);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.pause\.HH/ig, pHH);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.pause\.MIN/ig, pMIN);
    res = res.replace(/entry\[(?:n|\d*)\]\.stopwatch\.pause\.SS/ig, pSS);
    
    res = res.replace(/entry\[(?:n|\d*)\]\.tag\[(\d+)\]/ig, (_, p1) => {
        const idx = parseInt(p1) - 1;
        return (item.tags && item.tags[idx]) || '';
    });
    
    const cat = (!item.category || item.category === "(No Item)") ? '' : item.category;
    const qty = (item.quantity !== undefined && item.quantity !== 0 && item.quantity !== null) ? String(item.quantity) : '';
    const notes = item.notes || '';
    const task = (!item.taskStatus || item.taskStatus === "NONE") ? '' : item.taskStatus;
    
    res = res.replace(/entry\[(?:n|\d*)\]\.(?:category|item)/ig, cat);
    res = res.replace(/entry\[(?:n|\d*)\]\.(?:task)/ig, task);
    res = res.replace(/entry\[(?:n|\d*)\]\.(?:quantity|qty)/ig, qty);
    
    // Support entry[n].Notes[0]
    res = res.replace(/entry\[(?:n|\d*)\]\.note(?:s)?\[(\d+)\]/ig, (_, p1) => {
        const lineIdx = parseInt(p1);
        const lines = (item.notes || '').split('\n');
        return lines.length > lineIdx ? lines[lineIdx] : '';
    });
    
    // Support entry[n].Notes[l+X], typically l+1
    res = res.replace(/([ \t]*)entry\[(?:n|\d*)\]\.note(?:s)?\[l\+(\d+)\]/ig, (match, prefix, p1) => {
        const lineIdx = parseInt(p1);
        const lines = (item.notes || '').split('\n');
        if (lines.length > lineIdx) {
            return lines.slice(lineIdx).map((l, idx) => prefix + l.trimStart()).join('\n');
        }
        return '';
    });
    
    res = res.replace(/entry\[(?:n|\d*)\]\.note(?:s)?/ig, notes);
    
    res = res.replace(/\{item\}/ig, cat);
    res = res.replace(/\{qty\}/ig, qty);
    res = res.replace(/\{note(?:s)?\}/ig, notes);
    res = res.replace(/\{tags\}/ig, item.tags ? item.tags.join(', ') : '');
    
    // Depth-based indentation
    const depthPadding = '\t'.repeat(depth);
    
    // Fix multiple spaces (e.g. from empty variables) but preserve leading whitespace
    const cleanRes = res.split('\n').map(line => {
        const match = line.match(/^([ \t]*)(.*)$/);
        if (!match) return depthPadding + line;
        const indent = match[1];
        const content = match[2];
        return depthPadding + indent + content.replace(/ {2,}/g, ' ');
    }).join('\n');
    
    const finalRes = cleanRes.split('\n').map(line => {
        return line.replace(/^(\s*)-\s+<([^>]+)>\s*$/, '$1- <$2>');
    }).join('\n');
    
    return finalRes.trimEnd();
};
