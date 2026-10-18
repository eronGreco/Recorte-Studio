// Existing UI scenarios follow the task tabs before operating an inspector control.
export async function sidebarControl(page,selector){
 const locator=page.locator(selector);await locator.first().waitFor({state:'attached'});
 const pane=await page.evaluate(selector=>document.querySelector(selector)?.closest('.inspector-pane')?.id||null,selector);
 if(pane){const tab=page.locator('#sidebar-'+pane.replace('sidebar-pane-',''));if(await tab.getAttribute('aria-selected')!=='true')await tab.click();}
 return locator;
}
