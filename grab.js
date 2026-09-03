(function(){
var B="https://cg.wonderfulbot.org";
var HMAC_KEY_B64="NmMyZWI5MjQtY2ZmMi00MTVkLWEyZGUtYmU5ZmZlZTE5NTEyCg==";
var HOST="www.wonder.com";
var DESKTOP_MODE=!!window.__WONDER_DESKTOP_GRABBER__;
var DEBUG_SOURCES=[];

var panel=null,statusEl=null,actionBtn=null,resultEl=null,copyBtn=null;

function ensurePanel(){
  if(DESKTOP_MODE)return null;
  var existing=document.getElementById("wonder-cart-grabber-panel");
  if(existing)existing.remove();
  panel=document.createElement("div");
  panel.id="wonder-cart-grabber-panel";
  panel.style.cssText="position:fixed;right:14px;bottom:14px;z-index:2147483647;width:min(320px,calc(100vw - 28px));background:#191918;color:#f8fafc;border:1px solid #383838;border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.42);font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden";
  panel.innerHTML=''+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 12px 8px">'+
      '<div style="display:flex;align-items:center;gap:10px"><div style="display:grid;place-items:center;width:34px;height:34px;background:#fff;color:#135ce8;border-radius:8px;font-weight:900;font-size:13px;box-shadow:inset 0 -4px 0 #135ce8">K12</div><div><div style="font-weight:700;font-size:15px;color:#2563e8">K12 Cart Grabber</div><div id="wonder-cart-grabber-status" style="color:#9299a5;font-size:12px">Ready to grab this cart.</div></div></div>'+
      '<button id="wonder-cart-grabber-close" type="button" style="border:1px solid #dde3ea;background:#fff;color:#16202a;border-radius:6px;width:30px;height:30px;font-size:18px;line-height:1;cursor:pointer">x</button>'+
    '</div>'+
    '<div style="display:grid;gap:10px;padding:0 12px 12px">'+
      '<button id="wonder-cart-grabber-action" type="button" style="min-height:38px;border:0;border-radius:6px;background:#1463ff;color:#fff;font-weight:700;cursor:pointer">Grab my cart</button>'+
      '<div id="wonder-cart-grabber-result" style="display:none;border-top:1px solid #dde3ea;padding-top:10px"></div>'+
    '</div>'+
'<div style="border-top:1px solid #383838;padding:9px 14px;text-align:center;color:#b9c0ca;font-size:11px">K12 Tutoring · paste this code in the bot.</div>';
  document.body.appendChild(panel);
  statusEl=panel.querySelector("#wonder-cart-grabber-status");
  actionBtn=panel.querySelector("#wonder-cart-grabber-action");
  resultEl=panel.querySelector("#wonder-cart-grabber-result");
  panel.querySelector("#wonder-cart-grabber-close").onclick=function(){panel.remove();};
  actionBtn.onclick=function(){grabAndUpload();};
  return panel;
}

function setBusy(busy){
  if(!actionBtn)return;
  actionBtn.disabled=!!busy;
  actionBtn.textContent=busy?"Grabbing...":"Grab cart";
  actionBtn.style.opacity=busy?".65":"1";
}

function setStatus(msg,kind){
  if(!statusEl)return;
  statusEl.textContent=msg;
  statusEl.style.color=kind==="error"?"#b42318":kind==="ok"?"#0f6b3d":"#657384";
}

function showError(msg){
  setStatus(msg,"error");
  if(resultEl){
    resultEl.style.display="block";
    resultEl.innerHTML='<div style="color:#b42318;background:#fff1ef;border:1px solid #ffd0cc;border-radius:6px;padding:8px;overflow-wrap:anywhere">'+escapeHtml(msg)+'</div>';
  }
}

function showCode(code,count,name){
  setStatus("Cart code ready.","ok");
  if(!resultEl)return;
  resultEl.style.display="grid";
  resultEl.style.gap="8px";
  resultEl.innerHTML=''+
    '<div style="color:#657384;font-size:12px">'+escapeHtml(String(count))+' item'+(count===1?'':'s')+' from '+escapeHtml(name||"Wonder")+'</div>'+
    '<div style="font:22px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:2px;background:#f2f5f8;border:1px solid #dde3ea;border-radius:6px;padding:10px;text-align:center;user-select:all">'+escapeHtml(code)+'</div>'+
    '<button id="wonder-cart-grabber-copy" type="button" style="min-height:34px;border:1px solid #dde3ea;border-radius:6px;background:#fff;color:#16202a;font-weight:700;cursor:pointer">Copy code</button>';
  copyBtn=resultEl.querySelector("#wonder-cart-grabber-copy");
  copyBtn.onclick=function(){
    copyText(code).then(function(){
      copyBtn.textContent="Copied";
      setTimeout(function(){if(copyBtn)copyBtn.textContent="Copy code";},1200);
    });
  };
}

function fail(msg){
  showError(msg);
  return {success:false,error:msg};
}

var gateScriptPromise=null;
function cartClientToken(){
  if(typeof window==="undefined")return "";
  if(typeof window.__WONDER_CLIENT_CONFIG__==="string")return window.__WONDER_CLIENT_CONFIG__;
  if(typeof window.WONDER_CLIENT_CONFIG==="string")return window.WONDER_CLIENT_CONFIG;
  return "";
}
function loadScriptTag(src){
  return new Promise(function(resolve,reject){
    var script=document.createElement("script");
    var done=false;
    var timer=setTimeout(function(){
      if(done)return;
      done=true;
      try{script.remove();}catch(e){}
      reject(new Error("load fail"));
    },12000);
    script.onload=function(){
      if(done)return;
      done=true;
      clearTimeout(timer);
      resolve();
    };
    script.onerror=function(){
      if(done)return;
      done=true;
      clearTimeout(timer);
      try{script.remove();}catch(e){}
      reject(new Error("load fail"));
    };
    script.src=src;
    document.head.appendChild(script);
  });
}
async function ensureGate(){
  if(window.WonderCartGate&&window.WonderCartGate.Client)return;
  if(!gateScriptPromise){
    gateScriptPromise=(async function(){
      var src=B+"/static/security/gate.js?v="+Date.now();
      try{
        await loadScriptTag(src);
      }catch(e){
        var r=await fetch(src,{cache:"no-store",credentials:"omit"});
        if(!r.ok)throw new Error("load fail");
        (0,eval)(await r.text());
      }
      if(!(window.WonderCartGate&&window.WonderCartGate.Client))throw new Error("load fail");
    })();
  }
  return gateScriptPromise;
}
async function uploadCartCode(cart,itemCount){
  await ensureGate();
  var client=new window.WonderCartGate.Client({baseURL:B,blobWorker:true,clientToken:cartClientToken()});
  try{
    return await client.upload({label:cart.store_name+" - "+itemCount+" items",cart:cart,platform:"wonder"});
  }finally{
    try{client.cancel();}catch(e){}
  }
}

function escapeHtml(value){
  return String(value==null?"":value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function copyText(text){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).catch(function(){fallbackCopy(text);});
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text){
  var ta=document.createElement("textarea");
  ta.value=text;
  ta.style.cssText="position:fixed;left:-9999px;top:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{document.execCommand("copy");}catch(e){}
  ta.remove();
}

function requestId(){
  var c=typeof crypto!=="undefined"?crypto:null;
  if(c&&typeof c.randomUUID==="function")return c.randomUUID();
  var bytes=new Uint8Array(16);
  if(c&&c.getRandomValues)c.getRandomValues(bytes);
  else for(var i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  var hex=[];
  for(var j=0;j<bytes.length;j++)hex.push((bytes[j]+256).toString(16).slice(1));
  return hex.slice(0,4).join("")+"-"+hex.slice(4,6).join("")+"-"+hex.slice(6,8).join("")+"-"+hex.slice(8,10).join("")+"-"+hex.slice(10).join("");
}

function readMeta(id){
  try{var s=JSON.parse(sessionStorage.getItem("__wonder_cart_meta")||"{}");return s[id]||{};}
  catch(e){return{};}
}

function readLineMeta(id){
  if(!id)return{};
  try{var s=JSON.parse(sessionStorage.getItem("__wonder_cart_line_meta")||"{}");return s[id]||{};}
  catch(e){return{};}
}

function cartLineId(row,mi){
  var rowKeys=["cart_item_id","cartItemId","cart_item_uuid","cartItemUuid","checkout_item_id","checkoutItemId","line_item_id","lineItemId","item_uuid","itemUuid","uuid"];
  var itemKeys=["cart_item_id","cartItemId","cart_item_uuid","cartItemUuid","checkout_item_id","checkoutItemId","line_item_id","lineItemId","item_uuid","itemUuid","uuid"];
  var sources=[{src:row,keys:rowKeys},{src:mi,keys:itemKeys}];
  for(var s=0;s<sources.length;s++){
    var src=sources[s].src;
    if(!src||typeof src!=="object")continue;
    for(var i=0;i<sources[s].keys.length;i++){
      var v=src[sources[s].keys[i]];
      if(v!=null&&typeof v!=="object")return String(v);
    }
  }
  return "";
}

function moneyAmount(v){
  if(v==null||v==="")return null;
  if(typeof v==="number"){
    var n=Math.abs(v)>=100?v/100:v;
    return Math.round(n*100)/100;
  }
  var p=Number(String(v).replace(/[$,]/g,"").trim());
  return isFinite(p)?Math.round(p*100)/100:null;
}

function subtotalFromSources(){
  var keys=["expected_subtotal","formatted_subtotal","subtotal","line_subtotal","formatted_line_subtotal","item_subtotal","formatted_item_subtotal","total_price","formatted_total_price","price_of_total_quantity","priceOfTotalQuantity","subtotal_cents","total_cents"];
  for(var s=0;s<arguments.length;s++){
    var src=arguments[s];
    if(!src||typeof src!=="object")continue;
    for(var i=0;i<keys.length;i++){
      var amount=moneyAmount(src[keys[i]]);
      if(amount!=null)return amount;
    }
  }
  return null;
}

function checkoutSubtotal(data){
  return subtotalFromSources(data&&data.price_summary,data);
}

function debugClone(value,depth,state){
  state=state||{count:0};
  if(value==null)return value;
  if(typeof value==="string")return value.length>600?value.slice(0,600)+"...":value;
  if(typeof value!=="object")return value;
  state.count++;
  if(state.count>900)return "[debug-truncated]";
  if(depth<=0)return Array.isArray(value)?"[array]":"[object]";
  if(Array.isArray(value)){
    return value.slice(0,24).map(function(v){return debugClone(v,depth-1,state);});
  }
  var out={};
  Object.keys(value).slice(0,80).forEach(function(k){
    if(/image|photo|picture|thumbnail|hero|logo|url/i.test(k))return;
    out[k]=debugClone(value[k],depth-1,state);
  });
  return out;
}

function debugRecord(label,data){
  try{
    DEBUG_SOURCES.push({label:label,data:debugClone(data,8)});
    DEBUG_SOURCES=DEBUG_SOURCES.slice(-8);
  }catch(e){}
}

function cartItemObjectsFromCheckout(co){
  var out=[];
  var views=((co&&co.cart_restaurants)||[]).concat((co&&co.restaurant_views)||[]);
  views.forEach(function(v){
    ((v.checkout_items||[]).concat(v.cart_items||[],v.items||[])).forEach(function(i){
      if(i&&(i.menu_item||i.bundle_item||i.item))out.push(i);
    });
  });
  return out;
}

function cartItemIds(items){
  var ids={};
  (items||[]).forEach(function(i){
    var mi=i&&(i.menu_item||i.bundle_item||i.item)||{};
    var id=mi.menu_item_id||mi.bundle_item_id||mi.item_id||mi.id||mi.global_menu_item_id||i.menu_item_id||i.bundle_item_id||i.item_id;
    if(id)ids[String(id)]=true;
  });
  return ids;
}

function deepFind(obj,keys){
  var wanted={};
  (keys||[]).forEach(function(k){wanted[k]=true;});
  var seen=[];
  function walk(v){
    if(!v||typeof v!=="object"||seen.indexOf(v)>=0)return "";
    seen.push(v);
    var ks=Object.keys(v);
    for(var i=0;i<ks.length;i++){
      var k=ks[i];
      if(wanted[k]&&v[k]!=null&&typeof v[k]!=="object")return String(v[k]);
    }
    for(var j=0;j<ks.length;j++){
      var found=walk(v[ks[j]]);
      if(found)return found;
    }
    return "";
  }
  return walk(obj);
}

function cloneValue(value){
  if(value==null)return value;
  try{return JSON.parse(JSON.stringify(value));}
  catch(e){return value;}
}

function hasStructuredValue(value){
  if(value==null)return false;
  if(Array.isArray(value))return value.length>0;
  if(typeof value==="object")return Object.keys(value).length>0;
  if(typeof value==="string")return value.trim().length>0;
  return true;
}

function choiceValuesFromChoice(choice){
  if(!choice||typeof choice!=="object")return [];
  return choice.values||choice.choice_values||choice.choiceValues||choice.selected_values||choice.selectedValues||[];
}

function choiceValueMenuItemId(value){
  if(!value||typeof value!=="object")return "";
  var mi=value.menu_item||value.menuItem||value.item||value.bundle_item||value.bundleItem||{};
  return value.menu_item_id||value.menuItemId||value.item_id||value.itemId||mi.menu_item_id||mi.menuItemId||mi.item_id||mi.itemId||mi.id||"";
}

function hasReplayableChoices(choices){
  if(!Array.isArray(choices)||!choices.length)return false;
  for(var i=0;i<choices.length;i++){
    var choice=choices[i];
    if(!choice||typeof choice!=="object")return false;
    var choiceId=choice.choice_id||choice.choiceId||choice.id;
    var values=choiceValuesFromChoice(choice);
    if(!choiceId||!Array.isArray(values)||!values.length)return false;
    for(var j=0;j<values.length;j++){
      var value=values[j];
      if(!value||typeof value!=="object")return false;
      if(!(value.choice_value_id||value.choiceValueId||value.id))return false;
      if(!choiceValueMenuItemId(value))return false;
    }
  }
  return true;
}

function pickStructuredValue(sources,keys){
  var seen=[];
  function walk(value){
    if(!value||typeof value!=="object"||seen.indexOf(value)>=0)return null;
    seen.push(value);
    for(var i=0;i<keys.length;i++){
      var key=keys[i];
      if(Object.prototype.hasOwnProperty.call(value,key)&&hasStructuredValue(value[key]))return cloneValue(value[key]);
    }
    var ks=Object.keys(value);
    for(var j=0;j<ks.length;j++){
      var found=walk(value[ks[j]]);
      if(hasStructuredValue(found))return found;
    }
    return null;
  }
  for(var i=0;i<(sources||[]).length;i++){
    var found=walk(sources[i]);
    if(hasStructuredValue(found))return found;
  }
  return null;
}

function comboSelections(){
  var sources=Array.prototype.slice.call(arguments).filter(Boolean);
  var out={};
  var paired=pickStructuredValue(sources,[
    "paired_menu_items","pairedMenuItems","paired_items","pairedItems",
    "combo_items","comboItems","selected_combo_items","selectedComboItems",
    "selected_items","selectedItems","bundle_items","bundleItems",
    "selected_bundle_items","selectedBundleItems",
    "components","selected_components","selectedComponents",
    "component_items","componentItems","selected_component_items","selectedComponentItems",
    "included_items","includedItems","children","child_items","childItems",
    "combo_selections","comboSelections"
  ]);
  var bundleOptions=pickStructuredValue(sources,[
    "bundle_item_selected_option_values","bundleItemSelectedOptionValues",
    "selected_bundle_option_values","selectedBundleOptionValues",
    "bundle_selected_option_values","bundleSelectedOptionValues",
    "selected_option_values","selectedOptionValues",
    "component_selected_option_values","componentSelectedOptionValues",
    "selected_component_option_values","selectedComponentOptionValues",
    "bundle_choice_option_values","bundleChoiceOptionValues"
  ]);
  var choices=pickStructuredValue(sources,[
    "choices","Choices","selected_choices","selectedChoices",
    "choice_values","choiceValues","selected_choice_values","selectedChoiceValues",
    "choice_selections","choiceSelections","selected_choice_menu_items","selectedChoiceMenuItems",
    "choice_groups","choiceGroups","selected_choice_groups","selectedChoiceGroups",
    "bundle_choice_groups","bundleChoiceGroups",
    "bundle_choices","bundleChoices","bundle_choice_values","bundleChoiceValues",
    "component_choices","componentChoices","selected_component_choices","selectedComponentChoices"
  ]);
  if(hasStructuredValue(paired))out.paired_menu_items=paired;
  if(hasStructuredValue(bundleOptions))out.bundle_item_selected_option_values=bundleOptions;
  if(hasStructuredValue(choices))out.choices=choices;
  return out;
}

function optionPayload(){
  var sources=Array.prototype.slice.call(arguments).filter(Boolean);
  return pickStructuredValue(sources,[
    "options","selected_options","selectedOptions",
    "option_groups","optionGroups","selected_option_groups","selectedOptionGroups",
    "selected_option_values","selectedOptionValues",
    "cart_item_options","cartItemOptions","selected_menu_item_options","selectedMenuItemOptions",
    "modifiers","modifier_groups","modifierGroups",
    "selected_modifiers","selectedModifiers","selected_modifier_groups","selectedModifierGroups",
    "customizations","selected_customizations","selectedCustomizations",
    "customization_groups","customizationGroups","selected_customization_groups","selectedCustomizationGroups"
  ]);
}

function readEventLog(){
  try{
    var log=JSON.parse(sessionStorage.getItem("__wonder_cart_event_log")||"[]");
    if(!Array.isArray(log))return [];
    return log.slice(-20);
  }catch(e){return [];}
}

function extractVisibleCartSnapshot(){
  var pricePattern=/[-+]?(?:[$€£¥]|USD|CAD|AUD|EUR|GBP)\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?|[-+]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\s*(?:USD|CAD|AUD|EUR|GBP)/gi;
  var valuePattern=/^(?:[-+]?(?:[$€£¥]|USD|CAD|AUD|EUR|GBP)\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?|[-+]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\s*(?:USD|CAD|AUD|EUR|GBP)|free)$/i;
  function normalize(v){return String(v||"").replace(/\s+/g," ").trim();}
  function textOf(n){return normalize((n&&(n.innerText||n.textContent))||"");}
  function ownText(n){
    if(!n)return"";
    var out=[];
    for(var i=0;i<n.childNodes.length;i++){
      if(n.childNodes[i].nodeType===Node.TEXT_NODE)out.push(n.childNodes[i].textContent);
    }
    return normalize(out.join(" "));
  }
  function isVisible(n){
    if(!n||!(n instanceof Element))return false;
    var style=getComputedStyle(n);
    var rect=n.getBoundingClientRect();
    return style.display!=="none"&&style.visibility!=="hidden"&&style.opacity!=="0"&&rect.width>0&&rect.height>0;
  }
  function pricesFrom(text){
    pricePattern.lastIndex=0;
    var matches=normalize(text).match(pricePattern)||[];
    var seen={},out=[];
    for(var i=0;i<matches.length;i++){
      if(!seen[matches[i]]){seen[matches[i]]=true;out.push(matches[i]);}
    }
    return out;
  }
  function textLeaves(root){
    var nodes=root.querySelectorAll("p, span, a, h1, h2, h3, button, div");
    var out=[];
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i];
      if(!isVisible(n))continue;
      var text=normalize(n.textContent);
      if(!text)continue;
      var hasTextChild=false;
      for(var j=0;j<n.children.length;j++){
        if(normalize(n.children[j].textContent)){hasTextChild=true;break;}
      }
      if(!hasTextChild)out.push({node:n,text:text});
    }
    return out;
  }
  function normalizeLines(text){
    return String(text||"").split(/\n+/).map(normalize).filter(Boolean);
  }
  function isItemText(text,qty){
    if(!text)return false;
    if(pricesFrom(text).length&&valuePattern.test(text))return false;
    if(qty&&text===qty)return false;
    if(/^(add|add items|remove|continue to checkout|include utensils\??|quick additions|delivery|pickup)$/i.test(text))return false;
    if(/^(subtotal|promotion|delivery fee|service fee|other fees|taxes?|credit|total|code applied|add promo code)$/i.test(text))return false;
    if(/^[-+]?$/i.test(text))return false;
    return true;
  }
  function hasAddButton(root){
    var buttons=root.querySelectorAll("button");
    for(var i=0;i<buttons.length;i++){
      if(/^add$/i.test(normalize(buttons[i].textContent)))return true;
    }
    return false;
  }
  function hasCheckoutOrTotalsText(root){
    return /continue to checkout/i.test(textOf(root))||/\b(subtotal|promotion|delivery fee|service fee|other fees|taxes|credit|total)\b/i.test(textOf(root));
  }
  function findQuantity(root){
    var field=root.querySelector("input[name*='qty' i], input[aria-label*='quantity' i], input[class*='qty' i], select[name*='qty' i], select[aria-label*='quantity' i]");
    if(field&&field.value)return normalize(field.value);
    var leaves=textLeaves(root);
    for(var i=0;i<leaves.length;i++){
      var m=leaves[i].text.match(/(?:qty|quantity)\D*(\d+)/i);
      if(m)return m[1];
    }
    for(var j=0;j<leaves.length;j++){
      if(/^\d{1,2}$/.test(leaves[j].text))return leaves[j].text;
    }
    return "";
  }
  function findCheckoutRoot(){
    var roots=document.querySelectorAll("div, aside, section, [role='dialog'], [role='complementary']");
    var candidates=[];
    for(var i=0;i<roots.length;i++){
      if(!isVisible(roots[i]))continue;
      var text=textOf(roots[i]);
      if(/continue to checkout/i.test(text)&&/\b(subtotal|total)\b/i.test(text))candidates.push(roots[i]);
    }
    candidates.sort(function(a,b){return textOf(a).length-textOf(b).length;});
    return candidates[0]||document.body;
  }
  function findTotalRow(labelNode,root){
    var cur=labelNode.parentElement;
    while(cur&&cur!==root.parentElement){
      var leaves=textLeaves(cur).map(function(e){return e.text;});
      for(var i=0;i<leaves.length;i++){
        if(leaves.length>=2&&valuePattern.test(leaves[i]))return cur;
      }
      if(cur===root)break;
      cur=cur.parentElement;
    }
    return null;
  }
  function findTotals(root){
    var labelMap={subtotal:"subtotal",promotion:"promotion",discount:"discount",promo:"promotion",coupon:"promotion","delivery fee":"deliveryFee",shipping:"shipping","service fee":"serviceFee","other fees":"otherFees",tax:"taxes",taxes:"taxes",credit:"credit","estimated total":"estimatedTotal","order total":"total","grand total":"total",total:"total"};
    var totals={},leaves=textLeaves(root);
    for(var i=0;i<leaves.length;i++){
      var label=normalize(leaves[i].text).toLowerCase();
      var key=labelMap[label];
      if(!key)continue;
      var row=findTotalRow(leaves[i].node,root);
      if(!row)continue;
      var rowLeaves=textLeaves(row).map(function(e){return e.text;});
      var values=rowLeaves.filter(function(t){return normalize(t).toLowerCase()!==label&&valuePattern.test(t);});
      if(values.length)totals[key]=values[values.length-1];
    }
    var lines=normalizeLines(textOf(root));
    for(var j=0;j<lines.length;j++){
      var lower=lines[j].toLowerCase();
      Object.keys(labelMap).forEach(function(label){
        var key=labelMap[label];
        if(totals[key]||lower.indexOf(label)<0)return;
        var values=pricesFrom(lines[j]);
        if(/\bfree\b/i.test(lines[j]))values.push("Free");
        if(values.length)totals[key]=values[values.length-1];
      });
    }
    return totals;
  }
  function findRestaurantName(root){
    var links=Array.prototype.slice.call(root.querySelectorAll("a")).filter(isVisible);
    for(var i=0;i<links.length;i++){
      var text=normalize(links[i].textContent);
      if(!text)continue;
      if(/^(add items|try wonder\+|open order tracker)$/i.test(text))continue;
      if(valuePattern.test(text))continue;
      return text;
    }
    return "";
  }
  function cleanComponentTexts(texts,name,qty,price){
    var seen={},out=[];
    texts.forEach(function(text){
      var t=normalize(text);
      if(!isItemText(t,qty))return;
      if(t===name||t===price)return;
      if(/^[-\u2013\u2014]+$/.test(t))return;
      if(seen[t])return;
      seen[t]=true;
      out.push(t);
    });
    return out;
  }
  function visibleItemFromRow(row,priceNode,extractor){
    var price=pricesFrom(ownText(priceNode))[0]||pricesFrom(textOf(priceNode))[0]||"";
    var qty=findQuantity(row);
    var leaves=textLeaves(row).map(function(e){return normalize(e.text);}).filter(Boolean);
    var priceIndex=leaves.indexOf(price);
    var before=priceIndex>=0?leaves.slice(0,priceIndex):leaves;
    var clean=before.filter(function(t){return isItemText(t,qty);});
    var name=clean[0]||"";
    var components=cleanComponentTexts(clean.slice(1),name,qty,price);
    return {
      name:name,
      quantity:qty||"1",
      price:price,
      expected_subtotal:moneyAmount(price),
      expected_subtotal_source:"visible_cart_row",
      options:components,
      visible_components:components,
      selected_components:components,
      extractor:extractor,
      text:textOf(row).slice(0,500)
    };
  }
  try{
    var root=findCheckoutRoot();
    var priceNodes=Array.prototype.slice.call(root.querySelectorAll("p, span, div")).filter(function(n){
      var t=ownText(n);
      return isVisible(n)&&valuePattern.test(t)&&pricesFrom(t).length;
    });
    var seen=[],items=[];
    for(var p=0;p<priceNodes.length;p++){
      var priceNode=priceNodes[p];
      var row=priceNode.parentElement;
      while(row&&row!==root.parentElement){
        var rowText=textOf(row);
        if(row!==priceNode&&row.querySelector("img")&&!hasAddButton(row)&&!hasCheckoutOrTotalsText(row)&&rowText.length>5&&rowText.length<1500)break;
        if(row===root){row=null;break;}
        row=row.parentElement;
      }
      if(!row||seen.indexOf(row)>=0)continue;
      seen.push(row);
      items.push(visibleItemFromRow(row,priceNode,/MuiBox-root/.test(row.className||"")?"visible_wonder_mui_cart":"visible_wonder"));
      if(items.length>=40)break;
    }
    var extractor=items.some(function(item){return item.extractor==="visible_wonder_mui_cart";})?"visible_wonder_mui_cart":"visible_wonder";
    return {pageTitle:document.title,pageUrl:location.href,restaurant:findRestaurantName(root),totals:findTotals(root),extractor:extractor,items:items};
  }catch(e){
    return {extractor:"visible_wonder",error:String(e&&e.message||e),items:[]};
  }
}

function normalizeMatchName(value){
  return String(value||"")
    .toLowerCase()
    .replace(/\([^)]*\)/g," ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function visibleExpectedSubtotal(visibleItem){
  if(!visibleItem||typeof visibleItem!=="object")return null;
  var amount=moneyAmount(visibleItem.expected_subtotal);
  if(amount!=null)return amount;
  return moneyAmount(visibleItem.price);
}

function backfillExpectedSubtotalsFromVisibleCart(cart,visible){
  if(!cart||!Array.isArray(cart.items)||!visible||!Array.isArray(visible.items))return cart;
  var candidates=visible.items.map(function(item,index){
    return {
      item:item,
      index:index,
      name:normalizeMatchName(item&&item.name),
      amount:visibleExpectedSubtotal(item),
      used:false
    };
  }).filter(function(entry){return entry.name&&entry.amount!=null;});
  if(!candidates.length)return cart;
  cart.items.forEach(function(item,index){
    if(!item)return;
    var itemName=normalizeMatchName(item.name||item.item_name||item.menu_item_name||item.bundle_item_name);
    var match=null;
    if(itemName){
      for(var i=0;i<candidates.length;i++){
        if(!candidates[i].used&&candidates[i].name===itemName){match=candidates[i];break;}
      }
    }
    if(!match&&itemName){
      for(var j=0;j<candidates.length;j++){
        if(candidates[j].used)continue;
        if(candidates[j].name.indexOf(itemName)>=0||itemName.indexOf(candidates[j].name)>=0){match=candidates[j];break;}
      }
    }
    if(!match&&candidates[index]&&!candidates[index].used){
      match=candidates[index];
    }
    if(!match){
      for(var k=0;k<candidates.length;k++){
        if(!candidates[k].used){match=candidates[k];break;}
      }
    }
    if(!match)return;
    match.used=true;
    if(item.expected_subtotal==null){
      item.expected_subtotal=match.amount;
      item.expected_subtotal_source="visible_cart_row";
    }
    var visibleOptions=Array.isArray(match.item&&match.item.visible_components)?match.item.visible_components:(Array.isArray(match.item&&match.item.options)?match.item.options:[]);
    if(visibleOptions.length){
      item.visible_components=visibleOptions;
      item.visible_cart_options=visibleOptions;
      item.visible_cart_text=(match.item&&match.item.text)||"";
    }
  });
  return cart;
}

function findStore(){
  var els=document.querySelectorAll("body *");
  for(var j=0;j<els.length;j++){
    var keys=Object.keys(els[j]);
    for(var k=0;k<keys.length;k++){
      if(keys[k].startsWith("__reactFiber$")){
        var fiber=els[j][keys[k]],d=0;
        while(fiber&&d<300){
          var p=fiber.memoizedProps;
          if(p&&p.value&&p.value.store&&typeof p.value.store.getState=="function"){
            return p.value.store.getState();
          }
          fiber=fiber.return;d++;
        }
      }
    }
  }
  return null;
}

function readMenu(state){
  var m={};
  try{
    var info=(((state.app||{}).restaurant||{}).restaurantInfo||{}).menus||[];
    info.forEach(function(menu){
      (menu.categories||[]).forEach(function(cat){
        (cat.items||[]).forEach(function(it){
          indexMenuEntry(m,cat,it);
        });
      });
    });
  }catch(e){}
  return m;
}

function menuEntity(it){
  if(!it)return null;
  return it.menu_item||it.bundle_item||it.item||it;
}

function menuEntityId(mi){
  return mi&&(mi.id||mi.menu_item_id||mi.bundle_item_id||mi.item_id||mi.global_menu_item_id||"");
}

function menuEntityName(mi){
  return mi&&(mi.item_name||mi.menu_item_name||mi.name||mi.display_name||"");
}

function menuEntityVariation(mi){
  var v=mi&&(mi.variation||mi.menu_item_variation||mi.selected_variation||{});
  var vs=mi&&(mi.variations||mi.menu_item_variations||[]);
  var first=Array.isArray(vs)?vs[0]:null;
  var nested=deepFind(mi,["variation_id","variationId","menu_item_variation_id","menuItemVariationId","selected_variation_id","selectedVariationId","selected_menu_item_variation_id","selectedMenuItemVariationId","quick_add_variation_id","quickAddVariationId","default_variation_id","defaultVariationId","default_menu_item_variation_id","defaultMenuItemVariationId"]);
  return mi&&(mi.quick_add_variation_id||mi.quickAddVariationId||mi.variation_id||mi.variationId||mi.menu_item_variation_id||mi.menuItemVariationId||mi.selected_variation_id||mi.selectedVariationId||mi.selected_menu_item_variation_id||mi.selectedMenuItemVariationId||mi.default_variation_id||mi.defaultVariationId||mi.default_menu_item_variation_id||mi.defaultMenuItemVariationId||v.id||v.variation_id||v.variationId||v.menu_item_variation_id||v.menuItemVariationId||(first&&(first.id||first.variation_id||first.variationId||first.menu_item_variation_id||first.menuItemVariationId))||nested||"");
}

function indexMenuEntry(map,cat,it){
  var mi=menuEntity(it);
  var id=menuEntityId(mi);
  if(!id)return;
  var prev=map[id]||{};
  var catId=cat.id||cat.category_id||cat.category_run_id||"";
  var realCat=cat.type!=="POPULAR"&&(cat.id||cat.category_id);
  var useCat=!prev.category_id||(!prev._real_category&&realCat);
  var entry={
    category_id:useCat?catId:prev.category_id,
    category_name:useCat?(cat.name||cat.category_name||prev.category_name||""):prev.category_name,
    _real_category:prev._real_category||!!realCat,
    item_name:prev.item_name||menuEntityName(mi),
    quickAddVariationId:prev.quickAddVariationId||menuEntityVariation(mi),
    _menu_entity:prev._menu_entity||mi
  };
  map[id]=entry;
  [
    mi.id,mi.menu_item_id,mi.menuItemId,mi.bundle_item_id,mi.bundleItemId,
    mi.item_id,mi.itemId,mi.global_menu_item_id,mi.globalMenuItemId
  ].forEach(function(alias){
    if(alias&&!map[String(alias)])map[String(alias)]=entry;
  });
}

function firstScalar(source,keys){
  if(!source||typeof source!=="object")return "";
  for(var i=0;i<keys.length;i++){
    var value=source[keys[i]];
    if(value!=null&&typeof value!=="object")return String(value);
  }
  return "";
}

function firstArray(source,keys){
  if(!source||typeof source!=="object")return null;
  for(var i=0;i<keys.length;i++){
    var value=source[keys[i]];
    if(Array.isArray(value)&&value.length)return value;
  }
  return null;
}

function componentMatchName(value){
  return normalizeMatchName(String(value||"").replace(/\([^)]*\)/g," "));
}

function choiceValueName(value){
  var mi=value&&(value.menu_item||value.menuItem||value.item||value.bundle_item||value.bundleItem)||{};
  return firstScalar(value,[
    "name","display_name","displayName","choice_value_name","choiceValueName",
    "menu_item_name","menuItemName","item_name","itemName","bundle_item_name","bundleItemName"
  ])||firstScalar(mi,[
    "name","display_name","displayName","menu_item_name","menuItemName",
    "item_name","itemName","bundle_item_name","bundleItemName"
  ]);
}

function normalizeChoiceValue(value){
  if(!value||typeof value!=="object")return null;
  var mi=value.menu_item||value.menuItem||value.item||value.bundle_item||value.bundleItem||{};
  var choiceValueId=firstScalar(value,[
    "choice_value_id","choiceValueId","bundle_choice_value_id","bundleChoiceValueId",
    "value_id","valueId","id"
  ]);
  var menuItemId=firstScalar(value,[
    "menu_item_id","menuItemId","item_id","itemId","bundle_item_id","bundleItemId"
  ])||firstScalar(mi,[
    "menu_item_id","menuItemId","item_id","itemId","bundle_item_id","bundleItemId",
    "id","global_menu_item_id","globalMenuItemId"
  ]);
  var name=choiceValueName(value);
  if(!choiceValueId||!menuItemId||!name)return null;
  var out={
    choice_value_id:choiceValueId,
    menu_item_id:menuItemId,
    name:name,
    match_name:componentMatchName(name),
    quantity:Math.max(1,parseInt(value.quantity||value.selected_quantity||value.selectedQuantity||1,10)||1)
  };
  return out;
}

function extractBundleChoiceGroups(source){
  var groups=[],seen=[];
  var valueKeys=[
    "values","choice_values","choiceValues","selected_values","selectedValues",
    "items","options","bundle_choice_values","bundleChoiceValues"
  ];
  var groupIdKeys=[
    "choice_id","choiceId","bundle_choice_id","bundleChoiceId",
    "choice_group_id","choiceGroupId","id"
  ];
  function walk(value){
    if(!value||typeof value!=="object"||seen.indexOf(value)>=0)return;
    seen.push(value);
    if(!Array.isArray(value)){
      var groupId=firstScalar(value,groupIdKeys);
      var rawValues=firstArray(value,valueKeys);
      if(groupId&&rawValues){
        var normalizedValues=rawValues.map(normalizeChoiceValue).filter(Boolean);
        if(normalizedValues.length){
          groups.push({choice_id:groupId,values:normalizedValues});
        }
      }
      Object.keys(value).forEach(function(key){walk(value[key]);});
    }else{
      value.forEach(walk);
    }
  }
  walk(source);
  return groups;
}

function matchVisibleComponentToChoice(component,group,usedValueIds){
  var comp=componentMatchName(component);
  if(!comp)return null;
  var values=group&&group.values||[];
  for(var i=0;i<values.length;i++){
    var val=values[i];
    if(usedValueIds[val.choice_value_id])continue;
    if(comp===val.match_name||comp.indexOf(val.match_name)>=0||val.match_name.indexOf(comp)>=0)return val;
  }
  return null;
}

function fillBundleChoicesFromVisibleComponents(cart,menu){
  if(!cart||!Array.isArray(cart.items)||!menu)return cart;
  function menuEntryForItem(item){
    var direct=menu[item.item_id]||menu[item.bundle_item_id]||menu[item.bundleItemId];
    if(direct)return direct;
    var itemName=normalizeMatchName(item.name||item.bundle_item_name||item.bundleItemName||item.item_name||"");
    if(!itemName)return {};
    var keys=Object.keys(menu);
    for(var i=0;i<keys.length;i++){
      var entry=menu[keys[i]];
      var entryName=normalizeMatchName(entry&&entry.item_name);
      if(entryName&&(entryName===itemName||entryName.indexOf(itemName)>=0||itemName.indexOf(entryName)>=0))return entry;
    }
    return {};
  }
  cart.items.forEach(function(item){
    if(!item||hasReplayableChoices(item.choices||item.selected_choices||item.selectedChoices))return;
    var rawType=String(item.type||item.item_type||item.itemType||"").toUpperCase();
    var isBundle=rawType==="BUNDLE_ITEM"||!!item.bundle_item_id||!!item.bundleItemId;
    if(!isBundle)return;
    var components=Array.isArray(item.visible_components)?item.visible_components:(Array.isArray(item.visible_cart_options)?item.visible_cart_options:[]);
    components=components.filter(function(component){return componentMatchName(component);});
    if(!components.length)return;
    var menuEntry=menuEntryForItem(item);
    var groups=extractBundleChoiceGroups(menuEntry._menu_entity||menuEntry);
    if(!groups.length)return;
    var usedGroups={},usedValues={},choices=[];
    for(var i=0;i<components.length;i++){
      var matched=null,matchedGroup=null;
      for(var g=0;g<groups.length;g++){
        if(usedGroups[groups[g].choice_id])continue;
        var val=matchVisibleComponentToChoice(components[i],groups[g],usedValues);
        if(val){matched=val;matchedGroup=groups[g];break;}
      }
      if(!matched||!matchedGroup)return;
      usedGroups[matchedGroup.choice_id]=true;
      usedValues[matched.choice_value_id]=true;
      var value={
        choice_value_id:matched.choice_value_id,
        menu_item_id:matched.menu_item_id,
        quantity:matched.quantity||1
      };
      choices.push({choice_id:matchedGroup.choice_id,values:[value]});
    }
    if(choices.length===components.length){
      item.choices=choices;
      item.choices_source="visible_components_menu_match";
    }
  });
  return cart;
}

function normalizeReplayableChoices(choices){
  if(!Array.isArray(choices))return [];
  var out=[];
  for(var i=0;i<choices.length;i++){
    var choice=choices[i];
    if(!choice||typeof choice!=="object")continue;
    var choiceId=choice.choice_id||choice.choiceId||choice.id;
    var values=choiceValuesFromChoice(choice);
    if(!choiceId||!Array.isArray(values)||!values.length)continue;
    var cleanValues=[];
    for(var j=0;j<values.length;j++){
      var value=values[j];
      if(!value||typeof value!=="object")continue;
      var choiceValueId=value.choice_value_id||value.choiceValueId||value.id;
      var menuItemId=choiceValueMenuItemId(value);
      if(!choiceValueId||!menuItemId)continue;
      var cleanValue={
        choice_value_id:choiceValueId,
        menu_item_id:menuItemId,
        quantity:Math.max(1,parseInt(value.quantity||value.selected_quantity||value.selectedQuantity||1,10)||1)
      };
      if(Array.isArray(value.options))cleanValue.options=value.options;
      else if(value.menu_item&&Array.isArray(value.menu_item.options))cleanValue.options=value.menu_item.options;
      else if(value.menuItem&&Array.isArray(value.menuItem.options))cleanValue.options=value.menuItem.options;
      cleanValues.push(cleanValue);
    }
    if(cleanValues.length)out.push({choice_id:choiceId,values:cleanValues});
  }
  return hasReplayableChoices(out)?out:[];
}

function parseJsonMaybe(value){
  if(!value||typeof value!=="string")return null;
  try{return JSON.parse(value);}catch(e){return null;}
}

function fillBundleChoicesFromEventLog(cart){
  if(!cart||!Array.isArray(cart.items))return cart;
  var events=Array.isArray(cart.debug_event_log)?cart.debug_event_log:[];
  if(!events.length)return cart;
  var byBundleId={};
  events.forEach(function(event){
    if(!event||!event.request||!/bundle-item/i.test(String(event.url||"")))return;
    var body=parseJsonMaybe(event.request);
    if(!body||typeof body!=="object")return;
    var bundleId=body.bundle_item_id||body.bundleItemId||body.item_id||body.itemId;
    var choices=normalizeReplayableChoices(body.choices||body.selected_choices||body.selectedChoices);
    if(bundleId&&choices.length)byBundleId[String(bundleId)]=choices;
  });
  cart.items.forEach(function(item){
    if(!item||hasReplayableChoices(item.choices||item.selected_choices||item.selectedChoices))return;
    var bundleId=item.bundle_item_id||item.bundleItemId||item.item_id||item.itemId;
    var choices=bundleId&&byBundleId[String(bundleId)];
    if(choices&&choices.length){
      item.choices=choices;
      item.choices_source="event_log_bundle_request";
    }
  });
  return cart;
}

async function hmac(method,path,ts,params){
  var d=[],k=Object.keys(params||{}).sort();
  for(var i=0;i<k.length;i++){d.push(encodeURIComponent(k[i])+"="+encodeURIComponent(params[k[i]]));}
  var qs=d.join("&");
  var msg=method.toLowerCase()+"\n"+HOST+"\n"+path+"\n"+ts;
  if(qs)msg+="\n"+qs;
  var kb=Uint8Array.from(atob(HMAC_KEY_B64),function(c){return c.charCodeAt(0);});
  var ck=await crypto.subtle.importKey("raw",kb,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  var sig=await crypto.subtle.sign("HMAC",ck,new TextEncoder().encode(msg));
  var b="";new Uint8Array(sig).forEach(function(x){b+=String.fromCharCode(x);});
  return btoa(b);
}

async function fetchMenu(storeId,debugIds){
  var p={service_fee_user_variant:"VARIANT_A",time_zone:"America/New_York"};
  var ts=Date.now();
  var h=await hmac("GET","/order/ajax/restaurant/"+storeId,ts,p);
  var r=await fetch("/order/ajax/restaurant/"+storeId+"?"+Object.keys(p).map(function(k){return k+"="+encodeURIComponent(p[k]);}).join("&"),{
    credentials:"include",
    headers:{"x-hmac":h,"x-timestamp":String(ts),"x-request-id":requestId()}
  });
  var d=await r.json();
  var m={};
  var debugItems=[];
  (d.menus||[]).forEach(function(menu){
    (menu.categories||[]).forEach(function(cat){
      (cat.items||[]).forEach(function(it){
        indexMenuEntry(m,cat,it);
        var mi=menuEntity(it);
        var id=menuEntityId(mi);
        if(id&&debugIds&&debugIds[String(id)]){
          debugItems.push({category:{id:cat.id||cat.category_id||"",name:cat.name||cat.category_name||""},item:it});
        }
      });
    });
  });
  if(debugItems.length)debugRecord("restaurant_menu_items",debugItems);
  return m;
}

async function fetchCartBanner(){
  var ts=Date.now();
  var h=await hmac("GET","/order/ajax/cart/banner",ts);
  var r=await fetch("/order/ajax/cart/banner",{
    credentials:"include",
    headers:{"x-hmac":h,"x-timestamp":String(ts),"x-request-id":requestId()}
  });
  var d=await r.json();
  debugRecord("cart_banner",d);
  var items={};
  items.__items=[];
  var summary=d.cart_summary||{};
  var rv=(summary.restaurant_views||[]).concat(summary.cart_restaurants||[]);
  rv.forEach(function(v){
    (v.items||[]).concat(v.checkout_items||[],v.cart_items||[]).forEach(function(it){
      var id=it&&(it.item_id||it.menu_item_id||it.bundle_item_id);
      var lineId=cartLineId(it,it&&(it.menu_item||it.bundle_item||it.item));
      if(id){
        var payload=Object.assign({
          variation_id:it.variation_id||it.variationId||it.menu_item_variation_id||it.menuItemVariationId||"",
          options:Array.isArray(it.options)?it.options:[],
          expected_subtotal:subtotalFromSources(it)
        },comboSelections(it));
        payload.cart_item_id=lineId||"";
        payload.item_id=String(id);
        items.__items.push(payload);
        items[id]=payload;
        if(lineId)items[lineId]=payload;
      }
    });
  });
  return items;
}

function takeBannerPayload(banner,itemId,lineId,used){
  banner=banner||{};
  used=used||{};
  if(lineId&&lineId!==itemId&&banner[lineId]){
    used[lineId]=true;
    return banner[lineId];
  }
  var list=Array.isArray(banner.__items)?banner.__items:[];
  for(var i=0;i<list.length;i++){
    var entry=list[i];
    if(!entry||String(entry.item_id)!==String(itemId))continue;
    var key=entry.cart_item_id||String(itemId)+"#"+i;
    if(used[key])continue;
    used[key]=true;
    return entry;
  }
  return banner[itemId]||{};
}

async function fetchCheckout(){
  var ts=Date.now();
  var h=await hmac("GET","/order/ajax/checkout",ts);
  var r=await fetch("/order/ajax/checkout",{
    credentials:"include",
    headers:{"x-hmac":h,"x-timestamp":String(ts),"x-request-id":requestId()}
  });
  var d=await r.json();
  debugRecord("checkout_items",cartItemObjectsFromCheckout(d));
  return d;
}

function readItemQuantity(row,mi){
  var vals=[
    row&&row.quantity,
    row&&row.item_quantity,
    row&&row.qty,
    row&&row.count,
    row&&row.selected_quantity,
    row&&row.total_quantity,
    mi&&mi.quantity,
    mi&&mi.item_quantity,
    mi&&mi.qty,
    mi&&mi.count,
    mi&&mi.selected_quantity,
    mi&&mi.total_quantity
  ];
  for(var i=0;i<vals.length;i++){
    var n=Number(vals[i]);
    if(isFinite(n)&&n>0)return Math.max(1,Math.floor(n));
  }
  return 1;
}

function cartItemKey(it){
  var opts="";
  var paired="";
  var bundleOptions="";
  var choices="";
  try{opts=JSON.stringify(it.options||[]);}catch(e){opts="";}
  try{paired=JSON.stringify(it.paired_menu_items||null);}catch(e){paired="";}
  try{bundleOptions=JSON.stringify(it.bundle_item_selected_option_values||null);}catch(e){bundleOptions="";}
  try{choices=JSON.stringify(it.choices||null);}catch(e){choices="";}
  return [
    it.cart_item_id||"",
    it.type||"",
    it.bundle_item_id||"",
    it.item_id||"",
    it.variation_id||"",
    it.category_id||"",
    it.category_name||"",
    it.special_instructions||"",
    it.expected_subtotal==null?"":String(it.expected_subtotal),
    opts,
    paired,
    bundleOptions,
    choices
  ].join("||");
}

function mergeDuplicateCartItems(items){
  var byKey={},out=[];
  (items||[]).forEach(function(it){
    if(!it||!it.item_id)return;
    it.quantity=readItemQuantity(it,it);
    var key=cartItemKey(it);
    if(byKey[key]){
      byKey[key].quantity+=it.quantity;
    }else{
      byKey[key]=it;
      out.push(it);
    }
  });
  return out;
}

function cartQuantity(items){
  return (items||[]).reduce(function(sum,it){return sum+readItemQuantity(it,it);},0);
}

function buildCartFromCheckout(co, banner, apiMenu){
  var views=(co.cart_restaurants||[]).concat(co.restaurant_views||[]);
  if(!views.length)return null;
  var v=views[0];
  var citems=(v.checkout_items||[]).concat(v.cart_items||[],v.items||[]).filter(function(i){return i.menu_item||i.bundle_item||i.item;});
  if(!citems.length)return null;
  var state=findStore();
  var rdxMenu=state?readMenu(state):{};
  banner=banner||{};
  apiMenu=apiMenu||{};
  var bannerUsed={};
  var items=citems.map(function(i){
    var mi=i.menu_item||i.bundle_item||i.item||{};
    var mid=mi.menu_item_id||mi.bundle_item_id||mi.item_id||mi.id||mi.global_menu_item_id||"";
    var lineId=cartLineId(i,mi);
    var meta=readMeta(mid);
    var lineMeta=readLineMeta(lineId);
    var m=apiMenu[mid]||rdxMenu[mid]||{};
    var b=takeBannerPayload(banner,mid,lineId,bannerUsed);
    var cat=mi.category||mi.menu_category||{};
    var vari=mi.variation||mi.menu_item_variation||mi.selected_variation||{};
    var vars=mi.variations||mi.menu_item_variations||[];
    var firstVar=Array.isArray(vars)?vars[0]:null;
    var rawType=String(i.type||i.item_type||i.itemType||meta.type||"").toUpperCase();
    var isBundle=rawType==="BUNDLE_ITEM"||!!i.bundle_item||!!mi.bundle_item_id||!!mi.bundle_item_name||!!meta.bundle_item_id;
    var itemName=meta.menu_item_name||meta.bundle_item_name||m.item_name||mi.menu_item_name||mi.bundle_item_name||mi.item_name||mi.name||"";
    var item=Object.assign({
      type:isBundle?"BUNDLE_ITEM":"MENU_ITEM",
      item_id:mid,
      cart_item_id:lineId||undefined,
      bundle_item_id:isBundle?(meta.bundle_item_id||mi.bundle_item_id||mid):undefined,
      bundle_item_name:isBundle?itemName:undefined,
      name:itemName,
      category_id:meta.category_id||m.category_id||mi.category_id||cat.id||cat.category_id||mi.category_run_id||"",
      category_name:meta.category_name||m.category_name||mi.category_name||cat.name||cat.category_name||"",
      variation_id:b.variation_id||b.variationId||b.menu_item_variation_id||b.menuItemVariationId||meta.variation_id||meta.variationId||i.variation_id||i.variationId||i.menu_item_variation_id||i.menuItemVariationId||i.selected_variation_id||i.selectedVariationId||i.selected_menu_item_variation_id||i.selectedMenuItemVariationId||vari.id||vari.variation_id||vari.variationId||vari.menu_item_variation_id||vari.menuItemVariationId||(firstVar&&(firstVar.id||firstVar.variation_id||firstVar.variationId||firstVar.menu_item_variation_id||firstVar.menuItemVariationId))||m.quickAddVariationId||mi.quick_add_variation_id||mi.quickAddVariationId||mi.variation_id||mi.variationId||mi.menu_item_variation_id||mi.menuItemVariationId||mi.selected_variation_id||mi.selectedVariationId||mi.selected_menu_item_variation_id||mi.selectedMenuItemVariationId||deepFind(i,["variation_id","variationId","menu_item_variation_id","menuItemVariationId","selected_variation_id","selectedVariationId","selected_menu_item_variation_id","selectedMenuItemVariationId","quick_add_variation_id","quickAddVariationId"])||deepFind(mi,["variation_id","variationId","menu_item_variation_id","menuItemVariationId","selected_variation_id","selectedVariationId","selected_menu_item_variation_id","selectedMenuItemVariationId","quick_add_variation_id","quickAddVariationId"])||"",
      quantity:readItemQuantity(i,mi),
      options:lineMeta.options||b.options||optionPayload(i,mi)||meta.options||[],
      special_instructions:i.special_instructions||i.specialInstructions||mi.special_instructions||mi.specialInstructions||lineMeta.special_instructions||""
    },comboSelections(i,mi,b,lineMeta,meta));
    var expected=subtotalFromSources(i,mi,lineMeta,b);
    if(expected!=null)item.expected_subtotal=expected;
    return item;
  });
  return {
    store_id:v.restaurant_id,
    store_name:(v.restaurant_name_view||{}).name||(v.restaurant_name_view||{}).nickname||"",
    brand_category:co.brand_category||co.restaurant_brand_category||"WONDER_LOCAL",
    address:(co.address||{}),
    expected_subtotal:checkoutSubtotal(co),
    debug_event_log:readEventLog(),
    debug_sources:DEBUG_SOURCES.slice(),
    items:mergeDuplicateCartItems(items)
  };
}

function finalizeWonderCart(cart){
  if(!cart||!Array.isArray(cart.items))return cart;
  if(cart.expected_subtotal==null){
    var total=0;
    (cart.items||[]).forEach(function(it){
      var amount=moneyAmount(it&&it.expected_subtotal);
      if(amount!=null)total+=amount;
    });
    if(total>0)cart.expected_subtotal=Math.round(total*100)/100;
  }
  if(cart.brand_category==="WONDER_HDR"){
    cart.items=cart.items.map(function(it){
      it.category_id=it.category_id||null;
      it.variation_id=it.variation_id||null;
      return it;
    });
  }
  return cart;
}

function missingWonderItemFields(cart){
  var brand=cart&&cart.brand_category;
  return ((cart&&cart.items)||[]).map(function(it){
    var fields=[];
    var rawType=String(it.type||it.item_type||it.itemType||"").toUpperCase();
    var isBundle=rawType==="BUNDLE_ITEM"||!!it.bundle_item_id||!!it.bundleItemId;
    var hasSelections=!!(it.variation_id||it.variationId)
      || hasStructuredValue(it.options)
      || hasStructuredValue(it.paired_menu_items||it.pairedMenuItems)
      || hasStructuredValue(it.bundle_item_selected_option_values||it.bundleItemSelectedOptionValues)
      || hasReplayableChoices(it.choices||it.selected_choices||it.selectedChoices);
    if(!it.category_id&&!it.category_name)fields.push("category");
    if(isBundle&&!hasReplayableChoices(it.choices||it.selected_choices||it.selectedChoices))fields.push("choices");
    if(!isBundle&&!it.variation_id&&brand!=="WONDER_HDR")fields.push("variation");
    return fields.length?{item:it,fields:fields}:null;
  }).filter(Boolean);
}

function buildCartFromRedux(state){
  var stateCart=(((state.app||{}).cart||{}).cartData||{});
  var views=(stateCart.restaurant_views||[]).concat(stateCart.cart_restaurants||[]);
  var cartData=views[0];
  if(!cartData)return null;
  var cartItems=(cartData.cart_items||[]).concat(cartData.checkout_items||[],cartData.items||[]).filter(function(i){return i.menu_item||i.bundle_item||i.item;});
  if(!cartItems.length)return null;
  var menu=readMenu(state);
  var items=cartItems.map(function(i){
    var mi=i.menu_item||i.bundle_item||i.item||{};
    var mid=mi.menu_item_id||mi.bundle_item_id||mi.item_id||mi.id||mi.global_menu_item_id||"";
    var lineId=cartLineId(i,mi);
    var meta=readMeta(mid);
    var lineMeta=readLineMeta(lineId);
    var m=menu[mid]||{};
    var cat=mi.category||mi.menu_category||{};
    var vari=mi.variation||mi.menu_item_variation||mi.selected_variation||{};
    var vars=mi.variations||mi.menu_item_variations||[];
    var firstVar=Array.isArray(vars)?vars[0]:null;
    var rawType=String(i.type||i.item_type||i.itemType||meta.type||"").toUpperCase();
    var isBundle=rawType==="BUNDLE_ITEM"||!!i.bundle_item||!!mi.bundle_item_id||!!mi.bundle_item_name||!!meta.bundle_item_id;
    var itemName=meta.menu_item_name||meta.bundle_item_name||m.item_name||mi.menu_item_name||mi.bundle_item_name||mi.item_name||mi.name||"";
    var item=Object.assign({
      type:isBundle?"BUNDLE_ITEM":"MENU_ITEM",
      item_id:mid,
      cart_item_id:lineId||undefined,
      bundle_item_id:isBundle?(meta.bundle_item_id||mi.bundle_item_id||mid):undefined,
      bundle_item_name:isBundle?itemName:undefined,
      name:itemName,
      category_id:meta.category_id||m.category_id||mi.category_id||cat.id||cat.category_id||mi.category_run_id||"",
      category_name:meta.category_name||m.category_name||mi.category_name||cat.name||cat.category_name||"",
      variation_id:meta.variation_id||meta.variationId||i.variation_id||i.variationId||i.menu_item_variation_id||i.menuItemVariationId||i.selected_variation_id||i.selectedVariationId||i.selected_menu_item_variation_id||i.selectedMenuItemVariationId||vari.id||vari.variation_id||vari.variationId||vari.menu_item_variation_id||vari.menuItemVariationId||(firstVar&&(firstVar.id||firstVar.variation_id||firstVar.variationId||firstVar.menu_item_variation_id||firstVar.menuItemVariationId))||m.quickAddVariationId||mi.quick_add_variation_id||mi.quickAddVariationId||mi.variation_id||mi.variationId||mi.menu_item_variation_id||mi.menuItemVariationId||mi.selected_variation_id||mi.selectedVariationId||mi.selected_menu_item_variation_id||mi.selectedMenuItemVariationId||deepFind(i,["variation_id","variationId","menu_item_variation_id","menuItemVariationId","selected_variation_id","selectedVariationId","selected_menu_item_variation_id","selectedMenuItemVariationId","quick_add_variation_id","quickAddVariationId"])||deepFind(mi,["variation_id","variationId","menu_item_variation_id","menuItemVariationId","selected_variation_id","selectedVariationId","selected_menu_item_variation_id","selectedMenuItemVariationId","quick_add_variation_id","quickAddVariationId"])||"",
      quantity:readItemQuantity(i,mi),
      options:lineMeta.options||optionPayload(i,mi)||meta.options||[],
      special_instructions:i.special_instructions||i.specialInstructions||mi.special_instructions||mi.specialInstructions||lineMeta.special_instructions||""
    },comboSelections(i,mi,lineMeta,meta));
    var expected=subtotalFromSources(i,mi,lineMeta);
    if(expected!=null)item.expected_subtotal=expected;
    return item;
  });
  var address=((state.app||{}).fulfillment||{}).address||{};
  var brand=stateCart;
  return {
    store_id:cartData.restaurant_id,
    store_name:(cartData.restaurant_name_view||{}).name||(cartData.restaurant_name_view||{}).nickname||"",
    brand_category:brand.brand_category||brand.restaurant_brand_category||"WONDER_LOCAL",
    expected_subtotal:checkoutSubtotal(stateCart),
    debug_event_log:readEventLog(),
    debug_sources:DEBUG_SOURCES.slice(),
    address:{
      street_number:address.street_number||"",
      address_short_name:address.address_short_name||"",
      unit_number_or_company:address.unit_number_or_company||"",
      drop_off_type:address.drop_off_type||"",
      city:address.city||"",state:address.state||"",county:address.county||"",
      zip_code:address.zip_code||"",zip_code_extension:address.zip_code_extension||"",
      latitude:address.latitude||0,longitude:address.longitude||0
    },
    items:mergeDuplicateCartItems(items)
  };
}

async function grab(){
  var cart=null;
  var menu=null;
  var visible=extractVisibleCartSnapshot();
  if(visible&&visible.items&&visible.items.length)debugRecord("visible_cart_snapshot",visible);
  try{
    setStatus("Reading Wonder cart data...");
    var co=await fetchCheckout();
    setStatus("Reading item details...");
    var banner=await fetchCartBanner();
    var views=(co.cart_restaurants||[]).concat(co.restaurant_views||[]);
    if(!views.length){
      if(visible&&visible.items&&visible.items.length){
        return fail("The page shows "+visible.items.length+" visible item"+(visible.items.length===1?"":"s")+", but Wonder did not return a replayable checkout cart. Refresh Wonder, open the cart panel, and try again.");
      }
      return fail("No cart found. Add items first.");
    }
    var storeId=views[0].restaurant_id;
    menu=await fetchMenu(storeId,cartItemIds(cartItemObjectsFromCheckout(co)));
    cart=finalizeWonderCart(buildCartFromCheckout(co, banner, menu));
  }catch(e){
    return fail("Failed to load cart data. Make sure you are logged in on wonder.com.");
  }

  if(!cart||!cart.items||!cart.items.length){
    return fail("Cart is empty.");
  }
  if(visible&&visible.items&&visible.items.length){
    backfillExpectedSubtotalsFromVisibleCart(cart,visible);
    fillBundleChoicesFromEventLog(cart);
    fillBundleChoicesFromVisibleComponents(cart,menu);
    cart.debug_visible_cart=visible;
    if(!cart.store_name&&visible.restaurant)cart.store_name=visible.restaurant;
  }else{
    fillBundleChoicesFromEventLog(cart);
  }

  var missing=missingWonderItemFields(cart);
  if(missing.length){
    var details=missing.slice(0,3).map(function(m){
      var it=m.item;
      return (it.name||it.item_id||"item")+" ("+m.fields.join(", ")+")";
    }).join("; ");
    return fail("Missing data for "+missing.length+" item(s): "+details+". Refresh Wonder, remove/re-add the items, then try again.");
  }

  if(DESKTOP_MODE){
    return {success:true,cart:cart};
  }

  try{
    var itemCount=cartQuantity(cart.items);
    setStatus("Checking cart security...");
    var data=await uploadCartCode(cart,itemCount);
    if(data.code){
      showCode(data.code,itemCount,cart.store_name);
      return {success:true,code:data.code,cart:cart};
    }
    return fail("Upload failed: "+JSON.stringify(data));
  }catch(e){
    var message=String((e&&e.message)||e||"Upload failed");
    return fail("Error: "+message);
  }
}

async function grabAndUpload(){
  setBusy(true);
  if(resultEl){
    resultEl.style.display="none";
    resultEl.innerHTML="";
  }
  try{
    return await grab();
  }finally{
    setBusy(false);
  }
}

if(DESKTOP_MODE){
  return grab();
}
ensurePanel();
return {success:true,ui:true};
})();
