/** Evidence task-list contract provides identity and display_name only. */
export function projectEvidenceTasks(items){
 return items.map(item=>({id:item.task_id,title:typeof item.display_name==='string'&&item.display_name.trim()?item.display_name:item.task_id}));
}
