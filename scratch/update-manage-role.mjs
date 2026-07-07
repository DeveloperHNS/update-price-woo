import fs from 'fs';

let code = fs.readFileSync('app/dashboard/manage/[id]/page.tsx', 'utf8');

// 1. Add profile import
code = code.replace(/import \{ logActivity \} from "@\/lib\/activity-log";/, 'import { logActivity } from "@/lib/activity-log";\nimport { getCurrentProfile, type UserProfile } from "@/lib/profile";');

// 2. Add profile state
code = code.replace(/const \[toast, setToast\] = useState<\{msg: string, type: "success"\|"error"\} \| null>\(null\);/, 'const [toast, setToast] = useState<{msg: string, type: "success"|"error"} | null>(null);\n  const [profile, setProfile] = useState<UserProfile | null>(null);');

// 3. Update loadData useEffect
code = code.replace(/useEffect\(\(\) => \{\n    if \(id\) loadData\(\);\n  \}, \[id\]\);/, 'useEffect(() => {\n    if (id) {\n      getCurrentProfile().then(setProfile);\n      loadData();\n    }\n  }, [id]);');

// 4. Update Atribut Produk condition
code = code.replace(/\{isVariable && \(/, '{isVariable && profile?.role === "admin" && (');

// 5. Update Add New Variation condition
code = code.replace(/\{\/\* Add New Variation \*\/\}\n            <div className="bg-white/, '{/* Add New Variation */}\n            {profile?.role !== "admin" && (<div className="bg-white');
// Find the end of the Add New Variation block and close the condition
// It ends with: </button>\n                </div>\n              </div>\n            </div>
code = code.replace(/<\/button>\n                <\/div>\n              <\/div>\n            <\/div>/, '</button>\n                </div>\n              </div>\n            </div>)}');

fs.writeFileSync('app/dashboard/manage/[id]/page.tsx', code);
console.log("Role UI updated!");
