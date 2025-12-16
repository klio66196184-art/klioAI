
import * as XLSX from 'xlsx';
import { StudentData } from '../types';

export const parseExcel = (file: File): Promise<StudentData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const dataRows = rows.slice(1);

        const students: StudentData[] = dataRows
          .filter(row => row.length > 0 && row[2]) 
          .map((row, index) => {
            const grade = String(row[0] || '');
            const studentId = String(row[1] || '');
            const name = String(row[2] || '');
            const genderRaw = String(row[3] || 'M');
            const age = Number(row[4] || 0);
            const height = Number(row[5] || 0);
            const weight = Number(row[6] || 0);
            const bmi = Number(row[7] || (height > 0 ? (weight / Math.pow(height / 100, 2)).toFixed(2) : 0));
            // 欄位 I, J, K, L 對應索引 8, 9, 10, 11
            const handgrip = Number(row[8] || 0);
            const sitAndReach = Number(row[9] || 0);
            const standingLongJump = Number(row[10] || 0);
            const shuttleRun = Number(row[11] || 0);

            const gender = genderRaw.includes('女') || genderRaw.toUpperCase().startsWith('F') ? 'F' : 'M';

            return {
              id: `student-${index}-${Date.now()}`,
              grade,
              studentId,
              name,
              gender,
              age,
              height,
              weight,
              bmi,
              handgrip,
              sitAndReach,
              standingLongJump,
              shuttleRun
            };
          });
        resolve(students);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const generateTemplate = () => {
  const headers = [
    '年級Grade', '學號', '名', '姓別', '年齡', '身高', '體重', 'BMI', '手握力(kg)', '坐位體前屈(cm)', '立定跳遠(cm)', '15米折返跑'
  ];
  const data = [
    headers,
    ['F1', '2024001', '陳大文', '男', 12, 155, 45, 18.7, 22.5, 12.3, 180, 25],
    ['F1', '2024002', '李小美', '女', 12, 150, 40, 17.8, 18.2, 18.5, 165, 20]
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "學生數據");
  XLSX.writeFile(wb, "化地瑪體測數據模板.xlsx");
};
