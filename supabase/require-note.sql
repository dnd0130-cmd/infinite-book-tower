-- 한 줄 느낌을 필수로 만들기 (서버 쪽 검사)
-- Supabase SQL Editor에 붙여 넣고 실행하세요. 기존 함수를 같은 이름으로 바꿉니다.
create or replace function student_add_book(p_code text, p_number int, p_title text, p_pages int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_s students;
begin
  select s.* into v_s from students s join classes c on c.id = s.class_id
   where c.code = upper(trim(p_code)) and s.number = p_number;
  if not found then raise exception '학생 정보를 찾을 수 없어요'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception '책 제목을 적어 주세요'; end if;
  if p_pages < 1 or p_pages > 3000 then raise exception '쪽수는 1~3000 사이로 적어 주세요'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception '한 줄 느낌을 적어 주세요'; end if;
  insert into books (class_id, student_id, title, pages, note)
  values (v_s.class_id, v_s.id, left(trim(p_title), 100), p_pages, left(trim(p_note), 200));
end $$;

grant execute on function student_add_book(text, int, text, int, text) to anon, authenticated;
